import Link from 'next/link';
import { AzaMark } from '@/components/AzaMark';

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Build',
    links: [
      { href: '/developers/guides', label: 'Guides' },
      { href: '/developers/api-explorer', label: 'API Reference' },
      { href: '/developers/guides?doc=miniapps-intro', label: 'Mini Apps' },
    ],
  },
  {
    title: 'Operate',
    links: [
      { href: '/developers/changelog', label: 'Changelog' },
      { href: '/developers/status', label: 'System Status' },
      { href: 'https://merchants.aza.systems', label: 'Merchant Dashboard' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/developers/login', label: 'Sign in' },
      { href: '/developers/signup', label: 'Get API access' },
      { href: '/', label: 'Back to aza.systems' },
    ],
  },
];

export function DevFooter() {
  return (
    <footer className="border-t border-[#e5e7eb] bg-[#f8f9fa]">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-6 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-2.5">
            <AzaMark size={32} className="rounded-[9px]" />
            <span className="text-sm font-semibold tracking-tight text-[#374151]">developers</span>
          </span>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#6b7280]">
            The payments platform for Ghana. Build checkout, payouts, and Sign in with Aza on one REST API.
          </p>
        </div>
        {COLS.map(col => (
          <div key={col.title}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">{col.title}</p>
            <ul className="flex flex-col gap-2">
              {col.links.map(l => {
                const external = l.href.startsWith('http');
                return (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                      className="text-sm text-[#374151] transition-colors hover:text-[#174717]"
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[#e5e7eb]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-[#9ca3af] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} JumpSpaces, Inc. All rights reserved.</p>
          <p className="font-mono">api.aza.systems</p>
        </div>
      </div>
    </footer>
  );
}
