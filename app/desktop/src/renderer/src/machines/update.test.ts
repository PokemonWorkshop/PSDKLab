import type { MergeRequest, SessionLock } from '@psdk-lab/core';
import { describe, expect, it } from 'vitest';
import { createActor, fromPromise, waitFor } from 'xstate';
import type { MrSelection, SessionReport } from '../../../shared/ipc';
import { workflowMachine } from './workflow';

const report: SessionReport = {
  id: 'mr-1-abcdef0',
  dir: 'sessions/mr-1-abcdef0',
  gameDir: 'sessions/mr-1-abcdef0/game',
  lock: {} as SessionLock,
};
const mr = { iid: 1, sha: 'abcdef0123', title: 'Fix' } as MergeRequest;

describe('session update', () => {
  it('prepares the new head and passes the old sessions to replace', async () => {
    const inputs: MrSelection[] = [];
    const machine = workflowMachine.provide({
      actors: {
        prepare: fromPromise<SessionReport, MrSelection>(async ({ input }) => {
          inputs.push(input);
          return report;
        }),
      },
    });
    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'SELECT', mr });
    actor.send({ type: 'PREPARE', replace: ['mr-1-0000000'] });
    await waitFor(actor, (s) => s.matches('ready'));
    // From the ready screen of an old session too.
    actor.send({ type: 'PREPARE', replace: ['mr-1-0000000'] });
    await waitFor(actor, (s) => s.matches('ready'));
    // A plain preparation replaces nothing.
    actor.send({ type: 'BACK' });
    actor.send({ type: 'PREPARE' });
    await waitFor(actor, (s) => s.matches('ready'));
    expect(inputs.map((i) => i.replace)).toEqual([['mr-1-0000000'], ['mr-1-0000000'], []]);
  });
});
