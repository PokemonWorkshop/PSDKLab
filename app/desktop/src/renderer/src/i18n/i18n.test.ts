import { describe, expect, it } from 'vitest';
import en from './en.json';
import fr from './fr.json';

type Tree = { [key: string]: string | Tree };

/** Every key with its {{variables}} and <tags>, e.g. "game.log" → "path". */
function shape(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      const vars = value.match(/\{\{\w+\}\}|<\/?\w+>/g) ?? [];
      out[path] = [...vars].sort().join(' ');
    } else Object.assign(out, shape(value, path));
  }
  return out;
}

describe('translations', () => {
  it('has the same keys, variables and tags in French as in English', () => {
    expect(shape(fr)).toEqual(shape(en));
  });
});
