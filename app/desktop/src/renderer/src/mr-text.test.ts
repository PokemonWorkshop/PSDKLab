import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './components/Markdown';
import { instructions, plain, summary } from './mr-text';

const description = `<!-- template -->
Fixes the **double battle** effect of [Intimidate](https://example.com).

## What changed
- Something internal

## How to test
1. Start a double battle
2. Use \`Intimidate\`

### Edge cases
- [ ] Check both targets

\`\`\`ruby
# not a heading
\`\`\`

## Notes
Nothing else.`;

const html = (md: string) => renderToStaticMarkup(createElement(Markdown, { children: md }));

describe('mr-text', () => {
  it('turns Markdown into plain text', () => {
    expect(plain('**a** [b](u) `c` <br>')).toBe('a b c');
  });

  it('summarises the description with its first sentence, or its first step', () => {
    expect(summary(description)).toBe('Fixes the double battle effect of Intimidate.');
    expect(summary('## How to test\n- Open the bag')).toBe('Open the bag');
    expect(summary('')).toBe('');
  });

  it('keeps the test section as Markdown, sub-sections included, up to the next section', () => {
    const how = instructions(description);
    expect(how.section).toBe(true);
    expect(how.markdown.startsWith('1. Start a double battle')).toBe(true);
    expect(how.markdown).toContain('### Edge cases');
    expect(how.markdown).toContain('# not a heading'); // inside a code block
    expect(how.markdown).not.toContain('Nothing else');
  });

  it('falls back to the whole description, without the template comments', () => {
    expect(instructions('<!-- t -->\nPlay the intro.\n\nThen save.')).toEqual({
      markdown: 'Play the intro.\n\nThen save.',
      section: false,
    });
  });
});

describe('Markdown', () => {
  it('renders GitLab Markdown: lists, task lists, code, tables', () => {
    const out = html('1. one\n- [x] done\n\n`code`\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(out).toContain('<ol>');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('<code>code</code>');
    expect(out).toContain('<table>');
  });

  it('opens links in the browser and resolves GitLab relative links', () => {
    expect(html('[MR](https://gitlab.com/x)')).toContain('href="https://gitlab.com/x" target="_blank"');
    expect(html('[file](/uploads/abc/log.txt)')).toContain(
      'href="https://gitlab.com/pokemonsdk/pokemonsdk/uploads/abc/log.txt"',
    );
  });

  it('shows images as links, and never renders raw HTML', () => {
    const out = html('![battle](/uploads/a.png)\n\n<script>alert(1)</script><b>bold</b>');
    expect(out).toContain('🖼 battle');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<b>');
  });
});
