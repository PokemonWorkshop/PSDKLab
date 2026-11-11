import type { MergeRequest } from '@psdk-lab/core';
import { TEST_LABEL } from '@psdk-lab/core/constants';

/** Proposed for testing: carries the label maintainers use for that. */
export const isProposed = (mr: MergeRequest) => mr.labels.includes(TEST_LABEL);

const COMMENTS = /<!--[\s\S]*?-->/g; // GitLab templates leave HTML comments

/** Markdown reduced to plain text, for one-line summaries. */
export function plain(md: string): string {
  return md
    .replace(COMMENTS, '')
    .replace(/^\s*(```|~~~)[\s\S]*?^\s*\1[^\n]*$/gm, '') // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__|`)/g, '')
    .trim();
}

const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;
const FENCE = /^\s*(```|~~~)/;
// Section titles authors use for test steps (English and French).
const TEST_SECTION = /test|how to|steps|reproduce|consigne|vérif|verif|tester/i;

export interface Instructions {
  markdown: string; // rendered with react-markdown
  section: boolean; // true: a "how to test" section; false: the whole description
}

/**
 * The author's test instructions, as Markdown: the section whose title
 * mentions testing (up to the next heading of the same level or above), else
 * the whole description. Headings inside code blocks are ignored.
 */
export function instructions(description: string): Instructions {
  const lines = description.replace(COMMENTS, '').split(/\r?\n/);
  let inFence = false;
  let start = -1;
  let level = 0;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) inFence = !inFence;
    const h = inFence ? null : HEADING.exec(lines[i]);
    if (!h) continue;
    if (start < 0 && TEST_SECTION.test(h[2])) {
      start = i;
      level = h[1].length;
    } else if (start >= 0 && h[1].length <= level) {
      end = i;
      break;
    }
  }
  if (start < 0) return { markdown: lines.join('\n').trim(), section: false };
  return { markdown: lines.slice(start + 1, end).join('\n').trim(), section: true };
}

/** First sentence-like line of the description, for the MR card. */
export function summary(description: string): string {
  const lines = plain(description).split(/\r?\n/).map((l) => l.trim());
  const line =
    lines.find((l) => l && !HEADING.test(l) && !/^[-*+|>]|^\d+[.)]/.test(l)) ??
    // No introduction: the first instruction says what the MR is about.
    lines.map((l) => ITEM.exec(l)?.[1]?.trim()).find(Boolean);
  if (!line) return '';
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}
