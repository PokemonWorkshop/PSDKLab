import { useState } from 'react';

const TONES = ['accent', 'green', 'orange', 'red', 'violet'] as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const toneOf = (name: string) =>
  TONES[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % TONES.length];

/** GitLab avatar, or the initials when there is none (or it cannot load). */
export function Avatar(props: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [broken, setBroken] = useState(false);
  const { name, src, size = 'md' } = props;
  return (
    <span className="avatar" data-size={size} data-tone={toneOf(name)} title={name}>
      {src && !broken ? (
        <img src={src} alt="" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{initials(name) || '?'}</span>
      )}
    </span>
  );
}

/** Person outline, for the menu of a visitor who is not signed in. */
export function GuestAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className="avatar guest" data-size={size}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" />
      </svg>
    </span>
  );
}
