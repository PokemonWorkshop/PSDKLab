import type { MergeRequest } from '@psdk-lab/core';
import { TEST_LABEL } from '@psdk-lab/core/constants';

/** Proposed for testing: carries the label maintainers use for that. */
export const isProposed = (mr: MergeRequest) => mr.labels.includes(TEST_LABEL);

/** Markdown reduced to plain text: links, emphasis, code marks and HTML removed. */
export function plain(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*(```|~~~)[\s\S]*?^\s*\1[^\n]*$/gm, '') // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__|`)/g, '')
    .trim();
}

const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;
// Section titles authors use for test steps (English and French).
const TEST_SECTION = /test|how to|steps|reproduce|consigne|vérif|verif|tester/i;

/** First sentence-like line of the description, for the MR card. */
export function summary(description: string): string {
  const line = plain(description)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !HEADING.test(l) && !/^[-*+|>]|^\d+[.)]/.test(l));
  // No introduction: the first instruction says what the MR is about.
  const text = line ?? instructions(description).steps[0];
  if (!text) return '';
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export interface Instructions {
  steps: string[]; // list items, shown as a numbered list
  text: string[]; // paragraphs, when the author wrote no list
}

/**
 * The author's test instructions: the section whose title mentions testing
 * when there is one, else the whole description.
 */
export function instructions(description: string): Instructions {
  const lines = plain(description).split(/\r?\n/);
  const start = lines.findIndex((l) => {
    const h = HEADING.exec(l);
    return h !== null && TEST_SECTION.test(h[1]);
  });
  let part = lines;
  if (start >= 0) {
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => HEADING.test(l));
    part = end >= 0 ? rest.slice(0, end) : rest;
  }
  const steps = part
    .map((l) => ITEM.exec(l)?.[1]?.trim())
    .filter((s): s is string => !!s);
  if (steps.length > 0) return { steps: steps.slice(0, 12), text: [] };
  const text = part
    .map((l) => l.replace(HEADING, '$1').trim())
    .filter((l) => l && !l.startsWith('|'))
    .slice(0, 8);
  return { steps: [], text };
}
