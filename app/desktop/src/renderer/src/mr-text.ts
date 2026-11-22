import type { MergeRequest } from '@psdk-lab/core';
import { TEST_LABEL } from '@psdk-lab/core/constants';

/** Proposed for testing: carries the label maintainers use for that. */
export const isProposed = (mr: MergeRequest) => mr.labels.includes(TEST_LABEL);

const COMMENTS = /<!--[\s\S]*?-->/g;

/** Removes all HTML comments, including sequences revealed by previous replacements. */
function removeHtmlComments(input: string): string {
  let previous: string;

  do {
    previous = input;
    input = input.replace(COMMENTS, '');
  } while (input !== previous);

  return input;
}

/** Markdown reduced to plain text, for one-line summaries. */
export function plain(md: string): string {
  return removeHtmlComments(md)
    .replace(/^\s*(```|~~~)[\s\S]*?^\s*\1[^\n]*$/gm, '') // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)(\{[^}\n]*\})?/g, '') // images, with GitLab sizes
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[<>]/g, '')
    .replace(/(\*\*|__|`)/g, '')
    .trim();
}

const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;
const FENCE = /^\s*(```|~~~)/;

// Section of the PSDK MR template listing the tests, then titles other authors use.
const TEMPLATE_TESTS = /^tests? to reali[sz]e|^tests? à réaliser/i;
const TEST_SECTION = /test|how to|steps|reproduce|consigne|vérif|verif|tester/i;
const NOT_TESTS = /^before testing|^notes? to acknowledge/i;

export interface Instructions {
  markdown: string; // rendered with react-markdown
  section: boolean; // true: a "how to test" section, false: the whole description
}

/** The author's tests section (Markdown), else the whole description. */
export function instructions(description: string): Instructions {
  const lines = mrBody(description).body.split(/\r?\n/);
  let inFence = false;
  let start = -1;
  let level = 0;
  let end = lines.length;

  const headings: { i: number; level: number; title: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) inFence = !inFence;
    const h = inFence ? null : HEADING.exec(lines[i]);
    if (h) headings.push({ i, level: h[1].length, title: h[2].trim() });
  }
  const found =
    headings.find((h) => TEMPLATE_TESTS.test(h.title)) ??
    headings.find((h) => TEST_SECTION.test(h.title) && !NOT_TESTS.test(h.title));
  if (found) {
    start = found.i;
    level = found.level;
    end = headings.find((h) => h.i > start && h.level <= level)?.i ?? end;
  }

  if (start < 0) {
    return { markdown: lines.join('\n').trim(), section: false };
  }

  return {
    markdown: lines
      .slice(start + 1, end)
      .join('\n')
      .trim(),
    section: true,
  };
}

/** First sentence-like line of the description, for the MR card. */
export function summary(description: string): string {
  const lines = plain(mrBody(description).body)
    .split(/\r?\n/)
    .map((line) => line.trim());

  const line =
    lines.find(
      (line) => line && !HEADING.test(line) && !/^[-*+|>]|^\d+[.)]/.test(line),
    ) ??
    // No introduction: the first instruction says what the MR is about.
    lines.map((line) => ITEM.exec(line)?.[1]?.trim()).find(Boolean);

  if (!line) return '';

  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}

// Opening of the PSDK MR template: thanks and the author's submission checklist.
const TEMPLATE_INTRO = /thank you for your contribution|before submitting this merge request/i;
// GitLab quick actions (/label ~"…") are commands run on save, not text.
const QUICK_ACTION = /^\/[a-z_]+(\s|$)/;

export interface MrBody {
  intro: string; // the template's opening, empty when absent
  body: string; // the author's sections
}

/** Description as GitLab shows it, the template opening set apart. */
export function mrBody(description: string): MrBody {
  let inFence = false;
  const lines = removeHtmlComments(description)
    .split(/\r?\n/)
    .filter((line) => {
      if (FENCE.test(line)) inFence = !inFence;
      return inFence || !QUICK_ACTION.test(line.trim());
    });
  inFence = false;
  const first = lines.findIndex((line) => {
    if (FENCE.test(line)) inFence = !inFence;
    return !inFence && HEADING.test(line);
  });
  const intro = first > 0 ? lines.slice(0, first).join('\n').trim() : '';
  if (!intro || !TEMPLATE_INTRO.test(intro))
    return { intro: '', body: lines.join('\n').trim() };
  return { intro, body: lines.slice(first).join('\n').trim() };
}
