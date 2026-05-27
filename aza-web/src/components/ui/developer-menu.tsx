'use client';
import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { X } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(CustomEase);
}

type Props = { isOpen: boolean; onClose: () => void };

const devLinks = [
  { label: 'API Reference',    desc: 'Interactive REST endpoint explorer',     href: '/developers/api-explorer',          shape: '1' },
  { label: 'Developer Guides', desc: 'Tutorials, quickstarts & walkthroughs',  href: '/developers/guides',                shape: '2' },
  { label: 'Merchant Portal',  desc: 'Payments dashboard for your business',   href: 'https://merchants.aza.systems',     shape: '3' },
  { label: 'SDKs & Libraries', desc: 'HTTP client setup for Node, Python, PHP', href: '/developers/guides?doc=sdks',      shape: '4' },
  { label: 'System Status',    desc: 'Live uptime and API health checks',       href: '/developers/status',                shape: '5' },
];

const quickLinks = [
  { label: 'Changelog', href: '/developers/guides?doc=changelog' },
  { label: 'API Status', href: '/developers/status' },
];

export function DeveloperMenu({ isOpen, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!containerRef.current) return;
    const allShapeEls = containerRef.current.querySelectorAll('.dev-shape-el');
    gsap.set(allShapeEls, { opacity: 0, scale: 0.5 });

    const ctx = gsap.context(() => {
      const items = containerRef.current!.querySelectorAll('.dev-menu-item[data-shape]');
      const shapesWrap = containerRef.current!.querySelector('.dev-ambient-shapes');

      items.forEach((item) => {
        const idx = item.getAttribute('data-shape');
        const shape = shapesWrap?.querySelector(`.dev-shape-${idx}`);
        if (!shape) return;
        const els = shape.querySelectorAll('.dev-shape-el');

        const enter = () => {
          gsap.killTweensOf(shapesWrap!.querySelectorAll('.dev-shape-el'));
          gsap.set(shapesWrap!.querySelectorAll('.dev-shape-el'), { opacity: 0, scale: 0.5 });
          gsap.fromTo(els, { scale: 0.5, opacity: 0, rotation: -10 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.55, stagger: 0.07, ease: 'back.out(1.7)', overwrite: 'auto' });
        };
        const leave = () => {
          gsap.to(els, { scale: 0.7, opacity: 0, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
        };

        item.addEventListener('mouseenter', enter);
        item.addEventListener('mouseleave', leave);
        (item as any)._off = () => {
          item.removeEventListener('mouseenter', enter);
          item.removeEventListener('mouseleave', leave);
        };
      });
    }, containerRef);

    return () => {
      ctx.revert();
      containerRef.current?.querySelectorAll('.dev-menu-item[data-shape]').forEach((item: any) => item._off?.());
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      const wrapper  = containerRef.current!.querySelector<HTMLElement>('.dev-wrapper');
      const overlay  = containerRef.current!.querySelector('.dev-overlay');
      const panel    = containerRef.current!.querySelector('.dev-panel-content');
      const layers   = containerRef.current!.querySelectorAll('.dev-backdrop-layer');
      const links    = containerRef.current!.querySelectorAll('.dev-nav-link');
      const fadeEls  = containerRef.current!.querySelectorAll('[data-dev-fade]');
      const tl = gsap.timeline();

      if (isOpen) {
        tl.set(wrapper, { display: 'block' })
          .set(panel, { xPercent: 0 })
          .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 })
          .fromTo(layers, { xPercent: 101 }, { xPercent: 0, stagger: 0.1, duration: 0.55, ease: 'power3.out' }, '<')
          .fromTo(links, { yPercent: 130, rotate: 8 }, { yPercent: 0, rotate: 0, stagger: 0.05, duration: 0.6, ease: 'power3.out' }, '<+=0.28')
          .fromTo(fadeEls, { autoAlpha: 0, yPercent: 25 }, { autoAlpha: 1, yPercent: 0, stagger: 0.04, duration: 0.45, clearProps: 'all' }, '<+=0.1');
      } else {
        tl.to(overlay, { autoAlpha: 0, duration: 0.3 })
          .to(panel, { xPercent: 110, duration: 0.45, ease: 'power3.in' }, '<')
          .set(wrapper, { display: 'none' });
      }
    }, containerRef);
    return () => ctx.revert();
  }, [isOpen]);

  return (
    <div ref={containerRef}>
      <div className="dev-wrapper" style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 200 }}>
        <div className="dev-overlay" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />

        <nav className="dev-panel-content" aria-label="Developer menu" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div className="dev-backdrop-layer" style={{ position: 'absolute', inset: 0, background: '#2e7d2e' }} />
            <div className="dev-backdrop-layer" style={{ position: 'absolute', inset: 0, background: '#174717' }} />
            <div className="dev-backdrop-layer" style={{ position: 'absolute', inset: 0, background: '#0e2a0e' }} />
          </div>

          <div className="dev-ambient-shapes" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
            <svg className="dev-shape-1" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 600" fill="none">
              <circle className="dev-shape-el" cx="120" cy="130" r="90"  fill="rgba(183,238,122,0.07)" />
              <circle className="dev-shape-el" cx="640" cy="90"  r="130" fill="rgba(183,238,122,0.04)" />
              <circle className="dev-shape-el" cx="700" cy="450" r="70"  fill="rgba(46,125,50,0.3)" />
              <circle className="dev-shape-el" cx="380" cy="500" r="45"  fill="rgba(183,238,122,0.06)" />
            </svg>
            <svg className="dev-shape-2" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 600" fill="none">
              <path className="dev-shape-el" d="M0 280 Q200 130, 400 280 T 800 280" stroke="rgba(183,238,122,0.1)"  strokeWidth="80" fill="none" />
              <path className="dev-shape-el" d="M0 400 Q200 250, 400 400 T 800 400" stroke="rgba(183,238,122,0.06)" strokeWidth="50" fill="none" />
            </svg>
            <svg className="dev-shape-3" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 600" fill="none">
              {([100,220,340,460,580,700] as number[]).flatMap((x) =>
                ([110,240,370,500] as number[]).map((y) => (
                  <circle key={`${x}-${y}`} className="dev-shape-el" cx={x} cy={y} r="7" fill="rgba(183,238,122,0.2)" />
                ))
              )}
            </svg>
            <svg className="dev-shape-4" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 600" fill="none">
              <path className="dev-shape-el" d="M180 160 Q260 80,  340 160 Q420 240, 340 320 Q260 400, 180 320 Q100 240, 180 160" fill="rgba(183,238,122,0.07)" />
              <path className="dev-shape-el" d="M520 270 Q600 190, 680 270 Q760 350, 680 430 Q600 510, 520 430 Q440 350, 520 270" fill="rgba(183,238,122,0.05)" />
            </svg>
            <svg className="dev-shape-5" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 600" fill="none">
              <line className="dev-shape-el" x1="0"   y1="80"  x2="680" y2="600" stroke="rgba(183,238,122,0.08)" strokeWidth="70" />
              <line className="dev-shape-el" x1="200" y1="0"   x2="800" y2="480" stroke="rgba(183,238,122,0.05)" strokeWidth="45" />
            </svg>
          </div>

          <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', alignItems: 'center', padding: 'clamp(60px,8vh,100px) clamp(20px,5vw,80px)' }}>
            <div className="dev-menu-grid" style={{ width: '100%', maxWidth: '1260px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,360px)', gap: 'clamp(32px,5vw,96px)', alignItems: 'center' }}>

              <div>
                <p data-dev-fade style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(183,238,122,0.55)', marginBottom: '20px' }}>
                  DEVELOPER TOOLS
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {devLinks.map((l) => (
                    <li key={l.label} className="dev-menu-item" data-shape={l.shape} style={{ overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <a href={l.href} className="dev-nav-link" onClick={onClose} style={{ display: 'flex', flexDirection: 'column', padding: '13px 0', textDecoration: 'none', cursor: 'pointer' }}>
                        <span style={{ fontSize: 'clamp(1.5rem,2.6vw,2.3rem)', fontWeight: 800, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.03em', lineHeight: 1.1, transition: 'color 0.15s ease' }}>
                          {l.label}
                        </span>
                        <span data-dev-fade style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginTop: '3px' }}>
                          {l.desc}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="dev-menu-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div data-dev-fade style={{ background: 'rgba(183,238,122,0.05)', border: '1px solid rgba(183,238,122,0.14)', borderRadius: '16px', padding: '20px' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(183,238,122,0.65)', marginBottom: '6px' }}>
                    QUICK START
                  </p>
                  <p style={{ fontSize: '0.93rem', fontWeight: 600, color: 'white', marginBottom: '12px', lineHeight: 1.3 }}>
                    Accept payments in minutes
                  </p>
                  <pre style={{ fontSize: '0.7rem', fontFamily: '"JetBrains Mono","Fira Code",monospace', color: 'rgba(183,238,122,0.75)', background: 'rgba(0,0,0,0.35)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', overflowX: 'auto', lineHeight: 1.6, margin: '0 0 14px' }}>
{`curl -X POST \\
  https://api.aza.systems/api/v1/merchant/sessions \\
  -H "X-Api-Key: sk_live_..." \\
  -d '{"amount":50.00}'`}
                  </pre>
                  <a href="/developers/guides?doc=checkout" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', fontWeight: 600, color: '#B7EE7A', textDecoration: 'none' }}>
                    View checkout guide →
                  </a>
                </div>

                <div data-dev-fade style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a href="/developers/login" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 20px', borderRadius: '10px', background: '#B7EE7A', color: '#174717', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
                    Log in to Dashboard
                  </a>
                  <a href="/developers/signup" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 20px', borderRadius: '10px', background: 'rgba(183,238,122,0.08)', border: '1px solid rgba(183,238,122,0.2)', color: '#B7EE7A', fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none' }}>
                    Create an account
                  </a>
                </div>

                <div data-dev-fade style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {quickLinks.map(({ label, href }) => (
                    <a key={label} href={href} onClick={onClose} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s' }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(183,238,122,0.35)'; (e.target as HTMLElement).style.color = 'rgba(183,238,122,0.85)'; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button onClick={onClose} aria-label="Close developer menu" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 20, width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </nav>
      </div>
    </div>
  );
}
