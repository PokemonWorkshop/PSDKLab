import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { GitlabError, listMergeRequests, type MergeRequest } from './index';

export interface MrList {
  mrs: MergeRequest[];
  fetchedAt: string | null; // ISO date of the GitLab answer shown
  stale: boolean; // true when GitLab could not be asked and an older list is shown
  notice?: string; // why the list is stale, in plain words
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_BACKOFF_SEC = 60;

/**
 * The anonymous GitLab API is rate limited per IP (HTTP 429). This keeps the
 * MR list for a few minutes (memory + disk), merges concurrent calls, honours
 * Retry-After, and falls back to the last list instead of failing.
 */
export class MrCache {
  private list: MrList | null = null;
  private inflight: Promise<MrList> | null = null;
  private blockedUntil = 0;

  constructor(
    private readonly file: string,
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  /** `force` skips the freshness check (Refresh button), never the rate-limit wait. */
  get(force = false): Promise<MrList> {
    this.inflight ??= this.load(force).finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async load(force: boolean): Promise<MrList> {
    this.list ??= await this.readDisk();
    const age = this.list?.fetchedAt
      ? this.now() - Date.parse(this.list.fetchedAt)
      : Infinity;
    if (this.list && !force && age < this.ttlMs)
      return { ...this.list, stale: false, notice: undefined };
    if (this.now() < this.blockedUntil) return this.fallback(this.waitNotice());
    try {
      const mrs = await listMergeRequests(undefined, this.fetchFn);
      this.list = {
        mrs,
        fetchedAt: new Date(this.now()).toISOString(),
        stale: false,
      };
      await this.writeDisk(this.list);
      return this.list;
    } catch (err) {
      if (err instanceof GitlabError && err.status === 429) {
        this.blockedUntil =
          this.now() + (err.retryAfterSec ?? DEFAULT_BACKOFF_SEC) * 1000;
        return this.fallback(this.waitNotice());
      }
      return this.fallback(
        `GitLab unreachable (${(err as Error).message}).`,
        err,
      );
    }
  }

  private waitNotice(): string {
    const sec = Math.max(1, Math.ceil((this.blockedUntil - this.now()) / 1000));
    return `GitLab rate limits anonymous requests: retry possible in ${sec} s.`;
  }

  /** Last known list with a notice; without one, the error is surfaced. */
  private fallback(notice: string, cause?: unknown): MrList {
    if (this.list) return { ...this.list, stale: true, notice };
    throw cause instanceof Error && !(cause instanceof GitlabError)
      ? cause
      : new Error(notice);
  }

  private async readDisk(): Promise<MrList | null> {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as MrList;
    } catch {
      return null;
    }
  }

  private async writeDisk(list: MrList): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(list, null, 2));
  }
}
