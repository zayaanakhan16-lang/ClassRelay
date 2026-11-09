import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Menu, X, Users, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/start', label: 'Start teaching', icon: GraduationCap },
  { to: '/peers', label: 'Peer learning', icon: Users },
];

export function SiteHeader({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/10 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="ClassRelay home">
          <Logo withWordmark size={30} tone="dark" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
                  active ? 'bg-surface/[0.1] text-ink' : 'text-muted hover:bg-surface/[0.06] hover:text-ink',
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          {demo && <span className="chip-slate ml-2">Demo mode</span>}
        </nav>

        <button
          type="button"
          className="btn-ghost md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line/10 bg-paper/95 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink-soft hover:bg-surface/[0.07] hover:text-ink"
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line/10 bg-paper/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo withWordmark size={28} tone="dark" />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Every student has something to teach, and every student has something to learn.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm text-muted">
          <Link to="/start" className="hover:text-ink">Start teaching</Link>
          <Link to="/peers" className="hover:text-ink">Peer learning</Link>
          <Link to="/privacy" className="hover:text-ink">Privacy &amp; safety</Link>
          <a href="https://github.com/zayaanakhan16-lang/ClassRelay" className="hover:text-ink" rel="noreferrer" target="_blank">
            Source
          </a>
        </div>
      </div>
      <div className="border-t border-line/[0.07] px-4 py-4 text-center text-2xs uppercase tracking-[0.16em] text-muted/70 sm:px-6">
        Built for the CSC Winter Sparkathon 2026 · Learn it. Teach it. Pass it on.
      </div>
    </footer>
  );
}
