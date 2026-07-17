import Link from 'next/link';
import { AzaMark } from '@/components/AzaMark';

// Aza developer logo lockup: the Aza brand mark (aza-z.png) + optional section
// label. The image carries the brand; no text wordmark.
// `tone` picks the label color for light surfaces (default) vs. dark green chrome.
export function Logo({
  label = 'developers',
  tone = 'light',
  href = '/developers',
  size = 'md',
}: {
  label?: string;
  tone?: 'light' | 'dark';
  href?: string;
  size?: 'sm' | 'md';
}) {
  const markSize = size === 'sm' ? 28 : 32;
  const labelSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const labelColor = tone === 'dark' ? 'text-white/70' : 'text-[#374151]';

  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A]">
      <AzaMark size={markSize} className="shrink-0 rounded-[9px]" />
      {label && (
        <span className={`${labelSize} font-semibold tracking-tight ${labelColor}`}>{label}</span>
      )}
    </Link>
  );
}
