'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';

const LINKS = [
  { href: '/developers/guides',       label: 'Guides'   },
  { href: '/developers/api-explorer', label: 'API Reference' },
  { href: '/developers/apps',         label: 'Mini Apps' },
  { href: '/developers/changelog',    label: 'Changelog' },
  { href: '/developers/status',       label: 'Status'   },
];

// Shared sticky top nav for the light developer surfaces. `active` matches a
// LINKS href (or 'home') to mark the current page.
export function DevNav({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e7eb] bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map(l => {
            const isActive = active === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] ${
                  isActive ? 'text-[#174717]' : 'text-[#6b7280] hover:text-[#111827]'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/developers/login"
            className="ml-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#374151] transition-colors hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A]"
          >
            Sign in
          </Link>
          <Link
            href="/developers/signup"
            className="rounded-lg bg-[#0e2a0e] px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#174717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] focus-visible:ring-offset-2"
          >
            Get API access
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="grid h-9 w-9 place-items-center rounded-lg text-[#374151] hover:bg-[#f3f4f6] md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-[#e5e7eb] bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col">
            {LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active === l.href ? 'bg-[#f3f4f6] text-[#174717]' : 'text-[#374151]'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-[#f3f4f6] pt-3">
              <Link href="/developers/login" onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-[#e5e7eb] px-3 py-2 text-center text-sm font-semibold text-[#374151]">
                Sign in
              </Link>
              <Link href="/developers/signup" onClick={() => setOpen(false)}
                className="flex-1 rounded-lg bg-[#0e2a0e] px-3 py-2 text-center text-sm font-semibold text-white">
                Get API access
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
