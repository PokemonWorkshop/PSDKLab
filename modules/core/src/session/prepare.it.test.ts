// Integration test: prepares a real MR end to end (network: GitHub, GitLab, rubygems).
// Not part of `npm test`. Run it on purpose, on each reference OS:
//
//   npm run prepare:runtimes
//   PSDK_LAB_MR_IID=<iid> PSDK_LAB_MR_SHA=<head sha> npm run test:integration
//
// The MR is injected (no GitLab API call). Data goes to a temp folder whose
// path has spaces and accents, like a real user profile can.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runtimesAt } from '../runtimes/layout';
import { releaseCacheDir } from '../releases/index';
import type { SessionLock } from './index';
import { dataLayout, ensureDataLayout } from './layout';
import { prepareSession } from './prepare';
import type { SessionStep, StepUpdate } from './progress';
import { missingFiles } from './verify';

const iid = Number(process.env.PSDK_LAB_MR_IID);
const sha = process.env.PSDK_LAB_MR_SHA ?? '';
const runtimesRoot =
  process.env.PSDK_LAB_RUNTIMES ??
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../../runtimes/dist');

describe.skipIf(!iid || !sha)('prepare a standard MR (integration)', () => {
  const userData = mkdtempSync(join(tmpdir(), 'PSDK Lab données é '));
  const data = dataLayout(userData);
  const rt = runtimesAt(runtimesRoot, data.psdkCliDir);

  it(
    'prepares a playable, independent environment and records the versions',
    async () => {
      await ensureDataLayout(data);
      const done: SessionStep[] = [];
      const fractions: number[] = [];
      const session = await prepareSession({
        rt,
        data,
        mr: { iid, sha },
        onUpdate: (u: StepUpdate) => {
          if (u.state === 'done') done.push(u.step);
          if (u.step === 'demo' && u.fraction !== undefined) fractions.push(u.fraction);
        },
      });

      // Steps run in parallel: every one finishes once, ready last.
      expect([...done].sort()).toEqual(
        ['binaries', 'data', 'demo', 'mr', 'ready', 'restore', 'verify'],
      );
      expect(done.at(-1)).toBe('ready');
      // The demo's progress only moves forward.
      expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
      expect(session.dir.startsWith(userData)).toBe(true);
      const binariesDir = releaseCacheDir(
        data.cacheDir,
        'binaries',
        session.lock.binariesVersion,
      );
      expect(missingFiles(session.gameDir, binariesDir)).toEqual([]);

      const lock = JSON.parse(
        readFileSync(join(session.dir, 'session.lock.json'), 'utf8'),
      ) as SessionLock;
      expect(lock.mr).toEqual({ iid, sha });
      expect(lock.pokemonsdk.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(lock.demo.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(lock.binariesVersion).not.toBe('');
      expect(lock.psdkCliVersion).not.toBe('');
      expect(existsSync(join(session.dir, 'logs', 'restore.log'))).toBe(true);
    },
    20 * 60_000,
  );

  it('keeps the ready environment for a later launch', async () => {
    const updates: StepUpdate[] = [];
    const again = await prepareSession({
      rt,
      data,
      mr: { iid, sha },
      onUpdate: (u) => updates.push(u),
    });
    expect(updates).toEqual([
      { step: 'ready', state: 'done', fraction: 1, detail: { kind: 'cached' } },
    ]);
    expect(again.lock.mr.iid).toBe(iid);
  });
});
