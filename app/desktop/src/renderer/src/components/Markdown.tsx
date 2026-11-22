import { PSDK_PROJECT } from '@psdk-lab/core/constants';
import { useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BASE = `https://gitlab.com/${PSDK_PROJECT}/`;
const SIZE = 'psdk-size=';
const VIDEO = /\.(mp4|webm|mov|m4v|ogv)$/i;

/** Absolute URL of a GitLab link. Uploads live under /-/project/<id>/uploads/. */
export function absolute(
  href: string | undefined,
  projectId?: number,
): string | undefined {
  if (!href) return undefined;
  try {
    if (href.startsWith('/uploads/'))
      return projectId
        ? new URL(`/-/project/${projectId}${href}`, BASE).href
        : new URL(href.slice(1), BASE).href;
    return new URL(href, BASE).href;
  } catch {
    return undefined;
  }
}

/** Only GitLab's own media are loaded (also allowed by the page CSP), others stay links. */
function isGitlabMedia(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    (url.hostname === 'gitlab.com' ||
      url.hostname.endsWith('.gitlab-static.net') ||
      url.hostname === 'secure.gravatar.com')
  );
}

/** ![x](a.png){width=478 height=384} → size kept in the URL fragment. */
export function gitlabAttributes(md: string): string {
  return md.replace(
    /(!\[[^\]]*\]\()([^)\s]+)(\))\{([^}\n]*)\}/g,
    (_all, open: string, url: string, close: string, attrs: string) => {
      const w = /width=["']?(\d+)/.exec(attrs)?.[1] ?? '';
      const h = /height=["']?(\d+)/.exec(attrs)?.[1] ?? '';
      return w || h ? `${open}${url}#${SIZE}${w}x${h}${close}` : `${open}${url}${close}`;
    },
  );
}

function Media(props: { src?: string; alt?: string; projectId?: number }) {
  const { alt } = props;
  const [broken, setBroken] = useState(false);
  const href = absolute(props.src, props.projectId);
  const url = href ? new URL(href) : null;
  const [w, h] = url?.hash.startsWith(`#${SIZE}`)
    ? url.hash.slice(SIZE.length + 1).split('x')
    : [];
  if (url?.hash.startsWith(`#${SIZE}`)) url.hash = '';
  if (!url || !isGitlabMedia(url) || broken)
    return (
      <a href={url?.href ?? href} target="_blank" rel="noreferrer">
        {alt || 'image'}
      </a>
    );
  if (VIDEO.test(url.pathname))
    return <video className="md-media" src={url.href} controls preload="metadata" onError={() => setBroken(true)} />;
  return (
    <a href={url.href} target="_blank" rel="noreferrer" className="md-media-link">
      <img
        className="md-media"
        src={url.href}
        alt={alt ?? ''}
        loading="lazy"
        width={w ? Number(w) : undefined}
        height={h ? Number(h) : undefined}
        onError={() => setBroken(true)}
      />
    </a>
  );
}

const componentsFor = (projectId?: number): Components => ({
  a: ({ href, children }) => (
    <a href={absolute(href, projectId)} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <Media
      src={typeof src === 'string' ? src : undefined}
      alt={alt}
      projectId={projectId}
    />
  ),
});

/** GitLab Markdown (GFM, images, videos). Raw HTML is not rendered. */
export function Markdown(props: { children: string; projectId?: number }) {
  const { children, projectId } = props;
  const components = useMemo(() => componentsFor(projectId), [projectId]);
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {gitlabAttributes(children)}
      </ReactMarkdown>
    </div>
  );
}
