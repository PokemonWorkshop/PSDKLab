import type { GameEnd, MergeRequest, SessionLock } from '@psdk-lab/core';
import { describe, expect, it } from 'vitest';
import { createActor, fromPromise, waitFor } from 'xstate';
import type { LaunchResult, SessionReport } from '../../../shared/ipc';
import { gameMachine } from './game';
import { ipcMessage, stepNumber, workflowMachine } from './workflow';

const closed: GameEnd = { kind: 'closed', log: 'game.log' };

function game(launch: () => Promise<LaunchResult>) {
  const machine = gameMachine.provide({
    actors: { launch: fromPromise(launch) },
  });
  const actor = createActor(machine, { input: { sessionId: 'mr-1-abcdef0' } });
  actor.start();
  return actor;
}

describe('gameMachine', () => {
  it('goes starting → running → ended, then can launch again', async () => {
    const actor = game(async () => 'started');
    actor.send({ type: 'LAUNCH' });
    expect(actor.getSnapshot().value).toBe('starting');
    actor.send({ type: 'GAME', state: { kind: 'running', pid: 42 } });
    expect(actor.getSnapshot().value).toBe('running');
    expect(actor.getSnapshot().context.pid).toBe(42);
    actor.send({ type: 'GAME', state: closed });
    expect(actor.getSnapshot().value).toBe('ended');
    expect(actor.getSnapshot().context.end).toEqual(closed);

    actor.send({ type: 'LAUNCH' });
    expect(actor.getSnapshot().value).toBe('starting');
    expect(actor.getSnapshot().context.end).toBeNull();
  });

  it('ends straight from starting when the game exits before its window', () => {
    const actor = game(async () => 'started');
    actor.send({ type: 'LAUNCH' });
    const crash: GameEnd = {
      kind: 'crashed',
      during: 'startup',
      code: 1,
      signal: null,
      hint: null,
      output: 'LoadError',
      log: 'game.log',
    };
    actor.send({ type: 'GAME', state: crash });
    expect(actor.getSnapshot().value).toBe('ended');
    expect(actor.getSnapshot().context.end).toEqual(crash);
  });

  it('ignores a second launch while the game runs', () => {
    const actor = game(async () => 'started');
    actor.send({ type: 'LAUNCH' });
    actor.send({ type: 'GAME', state: { kind: 'running', pid: 42 } });
    actor.send({ type: 'LAUNCH' });
    expect(actor.getSnapshot().value).toBe('running');
  });

  it('follows a game started before the window was reloaded', async () => {
    const actor = game(async () => 'already-running');
    actor.send({ type: 'LAUNCH' });
    await waitFor(actor, (s) => s.matches('running'));
    expect(actor.getSnapshot().context.pid).toBeNull();
  });

  it('shows a failed IPC call as a launch failure', async () => {
    const actor = game(async () => {
      throw new Error('IPC down');
    });
    actor.send({ type: 'LAUNCH' });
    await waitFor(actor, (s) => s.matches('ended'));
    expect(actor.getSnapshot().context.end).toMatchObject({
      kind: 'failed',
      reason: 'spawn-error',
      detail: 'IPC down',
    });
  });
});

describe('workflowMachine', () => {
  const report: SessionReport = {
    id: 'mr-1-abcdef0',
    dir: 'sessions/mr-1-abcdef0',
    gameDir: 'sessions/mr-1-abcdef0/game',
    lock: {} as SessionLock,
  };
  const mr = { iid: 1, sha: 'abcdef0123', title: 'Fix' } as MergeRequest;

  function workflow(run: () => Promise<SessionReport>) {
    const machine = workflowMachine.provide({
      actors: { prepare: fromPromise(run) },
    });
    const actor = createActor(machine);
    actor.start();
    return actor;
  }

  it('needs a selected MR before preparing', () => {
    const actor = workflow(async () => report);
    actor.send({ type: 'PREPARE' });
    expect(actor.getSnapshot().value).toBe('selecting');
  });

  it('goes through the three steps: select, prepare (steps, progress), ready', async () => {
    let resolve!: (r: SessionReport) => void;
    const actor = workflow(() => new Promise((r) => (resolve = r)));
    actor.send({ type: 'SELECT', mr });
    actor.send({ type: 'PREPARE' });
    expect(stepNumber(actor.getSnapshot().value)).toBe(2);
    expect(actor.getSnapshot().context.steps).toEqual({});
    expect(actor.getSnapshot().context.startedAt).toBeTypeOf('number');
    // Steps running side by side each keep their own state.
    actor.send({
      type: 'UPDATE',
      update: { step: 'demo', state: 'active', fraction: 0.4 },
    });
    const download = { kind: 'download', received: 1024, total: 2048 } as const;
    actor.send({
      type: 'UPDATE',
      update: {
        step: 'binaries',
        state: 'active',
        fraction: 0.5,
        detail: download,
      },
    });
    actor.send({
      type: 'UPDATE',
      update: { step: 'demo', state: 'done', fraction: 1 },
    });
    expect(actor.getSnapshot().context.steps).toMatchObject({
      demo: { state: 'done' },
      binaries: { state: 'active', detail: download },
    });
    resolve(report);
    await waitFor(actor, (s) => s.matches('ready'));
    expect(stepNumber(actor.getSnapshot().value)).toBe(3);
    expect(actor.getSnapshot().context.session).toBe(report);
    actor.send({ type: 'BACK' });
    expect(actor.getSnapshot().value).toBe('selecting');
    expect(actor.getSnapshot().context.mr).toBe(mr); // the selection is kept
  });

  it('opens a session already prepared without preparing again', () => {
    const actor = workflow(async () => {
      throw new Error('must not prepare');
    });
    actor.send({ type: 'SELECT', mr });
    actor.send({ type: 'OPEN', session: report });
    expect(actor.getSnapshot().value).toBe('ready');
    expect(actor.getSnapshot().context.session).toBe(report);
  });

  it('reads the failed step from the error, then retries or goes back', async () => {
    let attempts = 0;
    const actor = workflow(async () => {
      attempts += 1;
      if (attempts === 1)
        throw new Error(
          "Error invoking remote method 'session:prepare': Error: [binaries] HTTP 503",
        );
      return report;
    });
    actor.send({ type: 'SELECT', mr });
    actor.send({ type: 'PREPARE' });
    await waitFor(actor, (s) => s.matches('failed'));
    expect(actor.getSnapshot().context).toMatchObject({
      failedStep: 'binaries',
      error: 'HTTP 503',
    });
    actor.send({ type: 'PREPARE' });
    await waitFor(actor, (s) => s.matches('ready'));
    expect(actor.getSnapshot().context.error).toBeNull();
  });

  it('falls back to the step still running when the error is not tagged', async () => {
    let fail!: (e: Error) => void;
    const actor = workflow(() => new Promise((_, reject) => (fail = reject)));
    actor.send({ type: 'SELECT', mr });
    actor.send({ type: 'PREPARE' });
    actor.send({
      type: 'UPDATE',
      update: { step: 'demo', state: 'done', fraction: 1 },
    });
    actor.send({
      type: 'UPDATE',
      update: { step: 'mr', state: 'active', fraction: 0.2 },
    });
    fail(new Error('boom'));
    await waitFor(actor, (s) => s.matches('failed'));
    expect(actor.getSnapshot().context).toMatchObject({
      failedStep: 'mr',
      error: 'boom',
    });
  });

  it('removes the Electron prefix from main process errors', () => {
    expect(
      ipcMessage(new Error("Error invoking remote method 'x': Error: boom")),
    ).toBe('boom');
    expect(ipcMessage(new Error('plain'))).toBe('plain');
  });
});
