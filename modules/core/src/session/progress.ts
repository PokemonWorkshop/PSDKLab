import type { GitPhase } from '../git/run';

export type SessionStep =
  | 'demo'
  | 'binaries'
  | 'mr'
  | 'restore'
  | 'data'
  | 'verify'
  | 'ready';

/** What a step is doing right now, for the interface to show (and translate). */
export type StepDetail =
  | { kind: 'download'; received: number; total: number } // bytes, total 0 if unknown
  | { kind: 'git'; phase: GitPhase }
  | { kind: 'items'; done: number; total: number } // files restored, data categories…
  | { kind: 'cached' } // reused from the local cache, nothing to do
  | { kind: 'boot' } // PSDK loading its scripts (silent, ~10 s on fresh files)
  | { kind: 'lookup' }; // asking the remote what changed (silent when nothing did)

/**
 * Progress of one step. Steps can run at the same time (demo, binaries and
 * pokemonsdk; then restore and data), so each one reports on its own.
 */
export interface StepUpdate {
  step: SessionStep;
  state: 'active' | 'done';
  fraction?: number; // 0..1 when known
  detail?: StepDetail;
}

export type OnUpdate = (u: StepUpdate) => void;

/**
 * Reports one step. The fraction never goes back (Git restarts at 0 % for
 * each of its phases), so the interface's bar only moves forward.
 */
export function reporter(step: SessionStep, onUpdate?: OnUpdate) {
  let max = 0;
  return {
    start: () => onUpdate?.({ step, state: 'active', fraction: 0 }),
    progress: (fraction: number, detail?: StepDetail) => {
      max = Math.max(max, Math.min(1, fraction));
      onUpdate?.({ step, state: 'active', fraction: max, detail });
    },
    done: (detail?: StepDetail) => onUpdate?.({ step, state: 'done', fraction: 1, detail }),
  };
}

/** Counts `needle` across chunks of output (a match can be split between two chunks). */
export function counter(needle: string, onCount: (n: number) => void) {
  let carry = '';
  let count = 0;
  return (chunk: string) => {
    const text = carry + chunk;
    let i = text.indexOf(needle);
    let found = 0;
    while (i >= 0) {
      found += 1;
      i = text.indexOf(needle, i + needle.length);
    }
    if (found > 0) {
      count += found;
      onCount(count);
    }
    // Keep the end, minus what was counted, to catch a needle split across chunks.
    const last = text.lastIndexOf(needle);
    const rest = last >= 0 ? text.slice(last + needle.length) : text;
    carry = rest.slice(-(needle.length - 1));
  };
}
