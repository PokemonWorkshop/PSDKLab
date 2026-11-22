import {
  createDiscussion,
  GitlabError,
  listDiscussions,
  listPublicDiscussions,
  replyToDiscussion,
  type Discussion,
} from '@psdk-lab/core';
import type { CommentInput, DiscussionList } from '../shared/ipc';
import { auth, broadcastAuth } from './auth';

const TTL_MS = 2 * 60 * 1000;

/** Threads per MR, read when an MR is opened and kept a little (no polling). */
const cache = new Map<number, { at: number; list: Discussion[] }>();

/** Account: REST API. Visitor: JSON of the MR page (the API refuses visitors). */
async function read(iid: number): Promise<Discussion[]> {
  const token = await auth().accessToken();
  if (token) {
    try {
      return await listDiscussions(iid, { token });
    } catch (err) {
      if (!(err instanceof GitlabError && err.status === 401)) throw err;
      // Token revoked on GitLab: signed out here too, then read as a visitor.
      await auth().rejected();
      await broadcastAuth();
    }
  }
  try {
    return await listPublicDiscussions(iid);
  } catch (err) {
    if (err instanceof GitlabError && [401, 403, 404].includes(err.status))
      throw new Error('sign-in-required', { cause: err });
    throw err;
  }
}

/** Anyone can read, commenting needs an account allowed to write. */
async function answer(
  list: Discussion[],
  at: number,
  stale = false,
  retryInSec: number | null = null,
): Promise<DiscussionList> {
  const status = await auth().status();
  const write = status.user !== null && status.canWrite;
  return {
    discussions: list,
    fetchedAt: new Date(at).toISOString(),
    stale,
    retryInSec,
    capabilities: { readDiscussions: true, comment: write, reply: write },
  };
}

export async function discussions(
  iid: number,
  force = false,
): Promise<DiscussionList> {
  const kept = cache.get(iid);
  if (kept && !force && Date.now() - kept.at < TTL_MS)
    return answer(kept.list, kept.at);
  try {
    const list = await read(iid);
    const at = Date.now();
    cache.set(iid, { at, list });
    return answer(list, at);
  } catch (err) {
    if (!kept) throw err;
    // Rate limited or offline: the threads read earlier stay visible.
    const retryInSec = err instanceof GitlabError ? err.retryAfterSec : null;
    return answer(kept.list, kept.at, true, retryInSec);
  }
}

/** New thread, or a reply when `discussionId` is set. Needs a signed-in account. */
export async function comment(input: CommentInput): Promise<DiscussionList> {
  const body = input.body.trim();
  if (!body) throw new Error('empty-comment');
  const token = await auth().accessToken();
  if (!token) throw new Error('signed-out');
  if (!(await auth().status()).canWrite) throw new Error('read-only-token');
  try {
    if (input.discussionId)
      await replyToDiscussion(input.iid, input.discussionId, body, { token });
    else await createDiscussion(input.iid, body, { token });
  } catch (err) {
    if (err instanceof GitlabError && err.status === 401) {
      await auth().rejected();
      await broadcastAuth();
      throw new Error('signed-out', { cause: err });
    }
    if (err instanceof GitlabError && err.status === 403)
      throw new Error('forbidden', { cause: err });
    throw err;
  }
  return discussions(input.iid, true);
}
