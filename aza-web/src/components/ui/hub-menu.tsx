'use client';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const HUB_APPS = [
  { name: 'Aza Business', desc: 'Accept payments & manage payouts', icon: '/hub-apps/aza-business.png' },
  { name: 'CediRates',    desc: 'Live exchange rates & fuel prices', icon: '/hub-apps/cedirates.png' },
  { name: 'Radio',        desc: 'Listen to live radio stations',     icon: '/hub-apps/radio.png' },
  { name: 'Games',        desc: '2048, Snake, Connect 4 & more',     icon: '/hub-apps/2048.png' },
];

export function HubMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={cn(
        'absolute left-1/2 -translate-x-1/2 top-[calc(100%+10px)] w-[300px] rounded-2xl p-4 z-50',
        'shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.07)]',
        'transition-[opacity,transform] duration-200 ease-out origin-top',
        open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
      )}
      style={{ background: '#0e2a0e' }}
    >
      <p
        className="text-[0.65rem] font-bold uppercase tracking-[0.1em] mb-3"
        style={{ color: 'rgba(183,238,122,0.55)' }}
      >
        Mini apps in the Hub
      </p>
      <div className="flex flex-col gap-1 mb-3">
        {HUB_APPS.map((app) => (
          <div key={app.name} className="flex items-center gap-3 px-1 py-1.5 rounded-xl">
            <Image src={app.icon} alt="" width={32} height={32} className="rounded-lg shrink-0" />
            <div className="min-w-0">
              <p className="text-[0.8rem] font-semibold text-white truncate">{app.name}</p>
              <p className="text-[0.7rem] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{app.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/#hub"
        onClick={onClose}
        className="flex items-center justify-center text-[0.8rem] font-bold px-3 py-2 rounded-xl transition-opacity hover:opacity-90"
        style={{ background: '#B7EE7A', color: '#174717' }}
      >
        Explore the Hub
      </Link>
    </div>
  );
}
