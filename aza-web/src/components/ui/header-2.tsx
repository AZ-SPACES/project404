'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import { useActiveSection } from '@/components/ui/use-active-section';
import { DeveloperMenu } from '@/components/ui/developer-menu';
import { HubMenu } from '@/components/ui/hub-menu';
import { Sun, Moon, Code2 } from 'lucide-react';

// Leading "/" makes these resolve correctly from any page, not just the homepage —
// a bare "#features" only works if you're already on "/".
const navLinks = [
  { label: 'Features',     href: '/#features'     },
  { label: 'How it works', href: '/#how-it-works'  },
  { label: 'Security',     href: '/#security'      },
  { label: 'Hub',          href: '/#hub'            },
  { label: 'FAQ',          href: '/#faq'            },
];

const sectionIds = navLinks.map((l) => l.href.replace('/#', ''));

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e2a0e]';

export function Header() {
  const [open,        setOpen]        = React.useState(false);
  const [devOpen,     setDevOpen]     = React.useState(false);
  const [hubMenuOpen, setHubMenuOpen] = React.useState(false);
  const [theme,       setTheme]       = React.useState<'light' | 'dark'>('light');
  const scrolled = useScroll(20);
  const pathname = usePathname();
  const activeSection = useActiveSection(sectionIds);
  const isDevelopersPage = pathname?.startsWith('/developers') ?? false;
  const hubCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cta = isDevelopersPage
    ? { href: '/developers/login', label: 'Log in' }
    : { href: '/#waitlist', label: 'Join waitlist' };

  const openHubMenu = () => {
    if (hubCloseTimer.current) clearTimeout(hubCloseTimer.current);
    setHubMenuOpen(true);
  };
  const closeHubMenuDelayed = () => {
    hubCloseTimer.current = setTimeout(() => setHubMenuOpen(false), 150);
  };

  React.useEffect(() => {
    // One-time hydration of the persisted theme after mount — the blocking
    // inline script in the root layout already set the DOM attribute pre-paint
    // to avoid a flash, this just syncs React state so the icon matches.
    const saved =
      localStorage.getItem('aza-theme') ??
      document.documentElement.getAttribute('data-theme') ??
      'light';
    setTheme(saved as 'light' | 'dark'); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Mobile menu scroll lock (dev menu manages its own)
  React.useEffect(() => {
    if (!devOpen) document.body.style.overflow = open ? 'hidden' : '';
    return () => { if (!devOpen) document.body.style.overflow = ''; };
  }, [open, devOpen]);

  React.useEffect(() => {
    if (!hubMenuOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setHubMenuOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hubMenuOpen]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aza-theme', next);
  };

  const openDevMenu = () => { setOpen(false); setDevOpen(true); };

  return (
    <>
      <header
        id="navbar"
        className={cn(
          'fixed left-0 right-0 z-50 flex justify-center px-4 sm:px-5',
          'transition-[padding-top] duration-300 ease-out',
          scrolled && !open ? 'pt-3' : 'pt-[14px]',
        )}
      >
        {/* Island pill */}
        <div
          className={cn(
            'w-full flex items-center h-[52px] px-3 pl-4',
            'transition-[max-width,box-shadow,transform] duration-300 ease-out rounded-[100px]',
            scrolled && !open
              ? 'max-w-[900px] shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.07)] scale-[0.985]'
              : 'max-w-full',
          )}
          style={{
            background: '#0e2a0e',
            animation: 'navEntrance 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both',
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center shrink-0 mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] rounded"
          >
            <Image src="/logo.png" alt="AZA" width={53} height={24} className="h-6 w-auto" priority />
          </Link>

          {/* Desktop nav */}
          <nav
            className="hidden md:flex items-center gap-[1px] flex-1 justify-center"
            aria-label="Main navigation"
          >
            {navLinks.map((l) => {
              const isActive = activeSection === l.href.replace('/#', '');
              const linkEl = (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive ? 'true' : undefined}
                  onFocus={l.label === 'Hub' ? openHubMenu : undefined}
                  className={cn(
                    'inline-flex items-center text-[0.84rem] font-medium px-[11px] py-[5px] rounded-lg transition-colors',
                    focusRing,
                    isActive ? 'text-white bg-white/[0.09]' : 'text-white/55 hover:text-white hover:bg-white/[0.09]',
                  )}
                >
                  {l.label}
                </Link>
              );

              if (l.label !== 'Hub') return linkEl;

              return (
                <div
                  key={l.href}
                  className="relative"
                  onMouseEnter={openHubMenu}
                  onMouseLeave={closeHubMenuDelayed}
                >
                  {linkEl}
                  <HubMenu open={hubMenuOpen} onClose={() => setHubMenuOpen(false)} />
                </div>
              );
            })}

            {/* Developers button */}
            <button
              onClick={openDevMenu}
              aria-current={isDevelopersPage ? 'true' : undefined}
              className={cn(
                'inline-flex items-center gap-[5px] text-[0.84rem] font-semibold px-[11px] py-[5px] rounded-lg transition-colors',
                focusRing,
                isDevelopersPage ? 'bg-[rgba(183,238,122,0.16)]' : 'hover:bg-[rgba(183,238,122,0.1)]',
              )}
              style={{ color: '#B7EE7A' }}
            >
              <Code2 size={13} />
              Developers
              <span
                className="px-[6px] py-[1px] text-[0.6rem] font-bold tracking-[0.07em] uppercase rounded"
                style={{ background: 'rgba(183,238,122,0.15)', border: '1px solid rgba(183,238,122,0.3)', color: '#B7EE7A' }}
              >
                Docs
              </span>
            </button>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white/60 transition-colors hover:text-white hover:bg-white/[0.08]',
                focusRing,
              )}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <Link
              href={cta.href}
              className={cn(
                'hidden md:inline-flex items-center text-[0.85rem] font-bold px-[18px] py-2 rounded-lg transition-opacity hover:opacity-90 ml-1',
                focusRing,
              )}
              style={{ background: '#B7EE7A', color: '#174717' }}
            >
              {cta.label}
            </Link>

            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={open}
              className={cn(
                'md:hidden w-9 h-9 flex items-center justify-center rounded-full text-white/70 transition-colors hover:text-white hover:bg-white/[0.08]',
                focusRing,
              )}
            >
              <MenuToggleIcon open={open} className="size-5" duration={300} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div
            className={cn(
              'md:hidden absolute left-4 right-4 flex flex-col gap-1 p-3',
              'rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.07)]',
              'animate-in zoom-in-95 fade-in-0 duration-200 ease-out',
              // While the menu is open the header always uses pt-[14px]
              // (the scrolled pt-3 only applies when closed), so the
              // dropdown offset is constant.
              'top-[calc(14px+52px+4px)]',
            )}
            style={{ background: '#0e2a0e' }}
          >
            {navLinks.map((l) => {
              const isActive = activeSection === l.href.replace('/#', '');
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'text-[0.9rem] font-medium px-4 py-[9px] rounded-2xl transition-colors',
                    focusRing,
                    isActive ? 'text-white bg-white/[0.09]' : 'text-white/55 hover:text-white hover:bg-white/[0.09]',
                  )}
                >
                  {l.label}
                </Link>
              );
            })}

            {/* Developers in mobile menu */}
            <button
              onClick={openDevMenu}
              aria-current={isDevelopersPage ? 'true' : undefined}
              className={cn(
                'text-left inline-flex items-center gap-2 text-[0.9rem] font-semibold px-4 py-[9px] rounded-2xl transition-colors',
                focusRing,
                isDevelopersPage ? 'bg-[rgba(183,238,122,0.16)]' : 'hover:bg-[rgba(183,238,122,0.1)]',
              )}
              style={{ color: '#B7EE7A' }}
            >
              <Code2 size={15} />
              Developers
            </button>

            <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <Link
              href={cta.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center justify-center text-[0.9rem] font-bold px-4 py-[10px] rounded-2xl',
                focusRing,
              )}
              style={{ background: '#B7EE7A', color: '#174717' }}
            >
              {cta.label}
            </Link>
          </div>
        )}
      </header>

      {/* Full-screen developer menu overlay */}
      <DeveloperMenu isOpen={devOpen} onClose={() => setDevOpen(false)} />
    </>
  );
}
