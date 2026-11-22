import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/** Small arrow of a dropdown, turned up while it is open. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`chevron${open ? ' open' : ''}`} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/** Open, close and keyboard behaviour shared by the dropdown menus. */
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = () => [
    ...(wrap.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? []),
  ];

  useEffect(() => {
    if (!open) return;
    (items().find((i) => i.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus();
    const onDown = (e: PointerEvent) =>
      !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') all[(i + 1) % all.length]?.focus();
    else if (e.key === 'ArrowUp') all[(i - 1 + all.length) % all.length]?.focus();
    else if (e.key === 'Escape') {
      setOpen(false);
      button.current?.focus();
    } else if (e.key === 'Tab') setOpen(false);
    else return;
    e.preventDefault();
  };

  return {
    open,
    close: () => setOpen(false),
    wrap,
    trigger: {
      ref: button,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      onClick: () => setOpen((o) => !o),
    },
    menu: { role: 'menu', onKeyDown },
  };
}
