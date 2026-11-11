import type { MergeRequest, SessionStep, StepUpdate } from '@psdk-lab/core';
import { assign, fromPromise, setup } from 'xstate';
import type { MrSelection, SessionReport } from '../../../shared/ipc';

export type WorkflowEvent =
  | { type: 'SELECT'; mr: MergeRequest }
  | { type: 'PREPARE' }
  | { type: 'OPEN'; session: SessionReport } // a session already prepared
  | { type: 'BACK' }
  | { type: 'UPDATE'; update: StepUpdate };

/** Last update of each step (several run at the same time). */
export type StepStates = Partial<Record<SessionStep, StepUpdate>>;

export interface WorkflowContext {
  mr: MergeRequest | null; // the MR selected in the list
  steps: StepStates;
  startedAt: number | null; // when the preparation started (elapsed time)
  failedStep: SessionStep | null;
  session: SessionReport | null;
  error: string | null;
}

/** The main process error, without Electron's "Error invoking remote method" prefix. */
export function ipcMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    '',
  );
}

const STEPS: SessionStep[] = [
  'demo',
  'binaries',
  'mr',
  'restore',
  'data',
  'verify',
  'ready',
];

/** "[binaries] HTTP 503" → step and message (the core tags failures with their step). */
export function splitFailure(message: string): {
  step: SessionStep | null;
  message: string;
} {
  const m = /^\[(\w+)\] ([\s\S]*)$/.exec(message);
  const step =
    m && (STEPS as string[]).includes(m[1]) ? (m[1] as SessionStep) : null;
  return step ? { step, message: m![2] } : { step: null, message };
}

/**
 * The tester's path, matching the three steps of the interface:
 * 1 selecting an MR → 2 preparing its session (or failed, to retry or go
 * back) → 3 ready to launch. Going back keeps the selected MR.
 */
export const workflowMachine = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as WorkflowEvent,
  },
  actors: {
    prepare: fromPromise<SessionReport, MrSelection>(({ input }) =>
      window.api.prepareSession(input),
    ),
  },
  guards: {
    hasMr: ({ context }) => context.mr !== null,
  },
}).createMachine({
  id: 'workflow',
  context: {
    mr: null,
    steps: {},
    startedAt: null,
    failedStep: null,
    session: null,
    error: null,
  },
  initial: 'selecting',
  states: {
    selecting: {
      on: {
        SELECT: { actions: assign({ mr: ({ event }) => event.mr }) },
        PREPARE: { guard: 'hasMr', target: 'preparing' },
        OPEN: {
          guard: 'hasMr',
          target: 'ready',
          actions: assign({
            session: ({ event }) => event.session,
            error: null,
          }),
        },
      },
    },
    preparing: {
      entry: assign({
        steps: {},
        startedAt: () => Date.now(),
        failedStep: null,
        error: null,
        session: null,
      }),
      invoke: {
        src: 'prepare',
        input: ({ context }) => ({
          iid: context.mr!.iid,
          sha: context.mr!.sha,
        }),
        onDone: {
          target: 'ready',
          actions: assign({ session: ({ event }) => event.output }),
        },
        onError: {
          target: 'failed',
          actions: assign(({ event, context }) => {
            const { step, message } = splitFailure(ipcMessage(event.error));
            // Untagged failure: the first step still running is the likely culprit.
            const running = STEPS.find(
              (s) => context.steps[s]?.state === 'active',
            );
            return { error: message, failedStep: step ?? running ?? null };
          }),
        },
      },
      on: {
        UPDATE: {
          actions: assign({
            steps: ({ context, event }) => ({
              ...context.steps,
              [event.update.step]: event.update,
            }),
          }),
        },
      },
    },
    ready: { on: { BACK: 'selecting' } },
    failed: { on: { PREPARE: 'preparing', BACK: 'selecting' } },
  },
});

/** Step of the interface (1, 2 or 3) for a workflow state. */
export function stepNumber(
  state: 'selecting' | 'preparing' | 'ready' | 'failed',
): 1 | 2 | 3 {
  if (state === 'selecting') return 1;
  return state === 'ready' ? 3 : 2;
}
