import { describe, expect, it } from 'vitest';
import { instructions, plain, summary } from './mr-text';

const description = `<!-- template -->
Fixes the **double battle** effect of [Intimidate](https://example.com).

## What changed
- Something internal

## How to test
1. Start a double battle
2. Use \`Intimidate\`
- [ ] Check both targets

## Notes
Nothing else.`;

describe('mr-text', () => {
  it('turns Markdown into plain text', () => {
    expect(plain('**a** [b](u) `c` <br>')).toBe('a b c');
  });

  it('summarises the description with its first sentence', () => {
    expect(summary(description)).toBe(
      'Fixes the double battle effect of Intimidate.',
    );
    expect(summary('')).toBe('');
  });

  it('takes the steps of the test section', () => {
    expect(instructions(description)).toEqual({
      steps: ['Start a double battle', 'Use Intimidate', 'Check both targets'],
      text: [],
    });
  });

  it('falls back to the paragraphs when the author wrote no list', () => {
    expect(instructions('Play the intro.\n\nThen save.')).toEqual({
      steps: [],
      text: ['Play the intro.', 'Then save.'],
    });
  });
});
