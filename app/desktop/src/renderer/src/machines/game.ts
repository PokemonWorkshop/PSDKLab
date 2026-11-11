import type { GameEnd, GameState } from '@psdk-lab/core';
import { assign, fromPromise, setup } from 'xstate';
import type { LaunchResult } from '../../../shared/ipc';

export type GameEvent = { type: 'LAUNCH' } | { type: 'GAME'; state: GameState };

export interface GameContext {
  sessionId: string;
  pid: number | null;
  end: GameEnd | null;
}

const isEnd = (s: GameState): s is GameEnd =>
  s.kind !== 'starting' && s.kind !== 'running';

/**
 * A session's game, as the tester sees it:
 * idle → starting (PSDK loading, no window) → running (window up) → ended.
 * From ended, the tester can launch again. States come from the main process
 * (GAME events); the `launch` actor only asks it to start the game.
 */
export const gameMachine = setup({
  types: {
    input: {} as { sessionId: string },
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actors: {
    launch: fromPromise<LaunchResult, { sessionId: string }>(({ input }) =>
      window.api.launchSession(input.sessionId),
    ),
  },
  guards: {
    running: ({ event }) =>
      event.type === 'GAME' && event.state.kind === 'running',
    ended: ({ event }) => event.type === 'GAME' && isEnd(event.state),
    alreadyRunning: ({ event }) =>
      'output' in event && event.output === 'already-running',
  },
  actions: {
    reset: assign({ pid: null, end: null }),
    setPid: assign({
      pid: ({ event }) =>
        event.type === 'GAME' && event.state.kind === 'running'
          ? event.state.pid
          : null,
    }),
    setEnd: assign({
      end: ({ event }) =>
        event.type === 'GAME' && isEnd(event.state) ? event.state : null,
    }),
  },
}).createMachine({
  id: 'game',
  context: ({ input }) => ({
    sessionId: input.sessionId,
    pid: null,
    end: null,
  }),
  initial: 'idle',
  states: {
    idle: { on: { LAUNCH: 'starting' } },
    starting: {
      entry: 'reset',
      invoke: {
        src: 'launch',
        input: ({ context }) => ({ sessionId: context.sessionId }),
        // Started earlier (e.g. the window was reloaded): its end will still come.
        onDone: { guard: 'alreadyRunning', target: 'running' },
        onError: {
          target: 'ended',
          actions: assign({
            end: ({ event }) => ({
              kind: 'failed',
              reason: 'spawn-error',
              detail: (event.error as Error).message,
            }),
          }),
        },
      },
      on: {
        GAME: [
          { guard: 'running', target: 'running', actions: 'setPid' },
          { guard: 'ended', target: 'ended', actions: 'setEnd' },
        ],
      },
    },
    running: {
      on: { GAME: { guard: 'ended', target: 'ended', actions: 'setEnd' } },
    },
    ended: { on: { LAUNCH: 'starting' } },
  },
});
