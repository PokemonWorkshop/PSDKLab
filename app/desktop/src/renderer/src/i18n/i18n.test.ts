import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES, LANGUAGES } from './index';

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
  const reference = shape(LANGUAGES.en.strings as Tree);
  for (const code of LANGUAGE_CODES.filter((c) => c !== 'en'))
    it(`has the same keys, variables and tags in ${LANGUAGES[code].name} as in English`, () => {
      expect(shape(LANGUAGES[code].strings as Tree)).toEqual(reference);
    });
});
