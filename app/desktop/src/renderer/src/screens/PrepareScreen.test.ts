import { describe, expect, it } from 'vitest';
import { overall } from './PrepareScreen';

describe('preparation progress', () => {
  it('weights the steps and only reaches 100 % when all are done', () => {
    expect(overall({})).toBe(0);
    const half = overall({
      demo: { step: 'demo', state: 'done', fraction: 1 },
      binaries: { step: 'binaries', state: 'done', fraction: 1 },
      mr: { step: 'mr', state: 'done', fraction: 1 },
      restore: { step: 'restore', state: 'active', fraction: 0.5 },
      data: { step: 'data', state: 'active', fraction: 0.5 },
    });
    expect(half).toBeCloseTo((25 + 10 + 15 + 45 * 0.5) / 100);
    const all = Object.fromEntries(
      (['demo', 'binaries', 'mr', 'restore', 'data', 'verify'] as const).map(
        (s) => [s, { step: s, state: 'done' as const, fraction: 1 }],
      ),
    );
    expect(overall(all)).toBe(1);
  });
});
