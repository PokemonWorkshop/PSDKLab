import { PSDK_PROJECT } from '@psdk-lab/core/constants';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BASE = `https://gitlab.com/${PSDK_PROJECT}/`;

function absolute(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href.startsWith('/uploads/') ? href.slice(1) : href, BASE)
      .href;
  } catch {
    return undefined;
  }
}

const components: Components = {
  a: ({ href, children }) => (
    <a href={absolute(href)} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <a
      href={absolute(typeof src === 'string' ? src : undefined)}
      target="_blank"
      rel="noreferrer"
    >
      {alt || 'image'}
    </a>
  ),
};

/**
 * An MR description written by its author, rendered as GitLab would (GFM:
 * task lists, tables, strikethrough). Raw HTML is not rendered.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
