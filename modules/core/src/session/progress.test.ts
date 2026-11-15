import { describe, expect, it } from 'vitest';
import { parseGitProgress } from '../git/run';
import { counter, reporter, type StepUpdate } from './progress';

describe('progress', () => {
  it('reads the last Git progress line of a chunk', () => {
    expect(parseGitProgress('Receiving objects:  12% (1/9)\rReceiving objects:  45% (4/9)')).toEqual({
      phase: 'receive',
      fraction: 0.45,
    });
    expect(parseGitProgress('Updating files:  48% (8129/16935)\r')).toEqual({
      phase: 'checkout',
      fraction: 0.48,
    });
    expect(parseGitProgress("Cloning into 'x'...")).toBeNull();
  });

  it('counts a word split across chunks', () => {
    const counts: number[] = [];
    const feed = counter('.yml', (n) => counts.push(n));
    feed('Data/A.rxdata.yml   Data/B.rxdata.y');
    feed('ml   Data/C.rxdata.yml');
    expect(counts).toEqual([1, 3]);
  });

  it('never moves a step backwards, even when Git restarts a phase at 0 %', () => {
    const updates: StepUpdate[] = [];
    const r = reporter('demo', (u) => updates.push(u));
    r.progress(0.3);
    r.progress(0.1);
    r.progress(0.6);
    r.done();
    expect(updates.map((u) => u.fraction)).toEqual([0.3, 0.3, 0.6, 1]);
    expect(updates.at(-1)?.state).toBe('done');
  });
});
