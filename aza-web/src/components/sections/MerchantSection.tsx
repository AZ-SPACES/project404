"use client";

import Link from "next/link";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const PERSONAL = [
  "Instant P2P transfers",
  "In-app encrypted chat",
  "QR scan & pay",
  "Payment requests in chat",
  "Mini apps marketplace",
  "AI spending insights",
];

const BUSINESS = [
  "Merchant payment links",
  "REST API & webhooks",
  "Real-time dashboard",
  "Bulk payouts to up to 100 recipients",
  "KYB in under 24 h",
  "Dedicated account manager",
];

function CheckIcon({ light }: { light?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 mt-0.5">
      <path
        d="M3 8l3.5 3.5L13 5"
        stroke={light ? "#B7EE7A" : "#174717"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MerchantSection() {
  const rootRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(leftRef.current, { x: -48, opacity: 0 }, {
        x: 0, opacity: 1, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: rootRef.current, start: "top 78%", toggleActions: "play none none none" },
      });
      gsap.fromTo(rightRef.current, { x: 48, opacity: 0 }, {
        x: 0, opacity: 1, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: rootRef.current, start: "top 78%", toggleActions: "play none none none" },
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="business" ref={rootRef} className="section-py" style={{ background: "#f5f5f7" }}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        <div className="text-center mb-12 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            For everyone who<br />moves money.
          </h2>
        </div>

        <div className="merchant-grid grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>

          {/* Personal */}
          <div ref={leftRef} className="rounded-2xl p-8 flex flex-col gap-6" style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div>
              <div className="text-[0.72rem] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: "#174717" }}>
                Personal
              </div>
              <h3 className="font-black leading-tight mb-2" style={{ fontSize: "1.5rem", color: "#1d1d1f", letterSpacing: "-0.03em" }}>
                Your money,<br />your way.
              </h3>
              <p className="text-[0.875rem] leading-[1.6]" style={{ color: "#6e6e73" }}>
                Everything you need for your daily financial life — in one secure app.
              </p>
            </div>

            <ul className="flex flex-col gap-2.5">
              {PERSONAL.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[0.875rem]" style={{ color: "#1d1d1f" }}>
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4 mt-auto">
              <Link
                href="/#waitlist"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[0.875rem] font-semibold transition-opacity hover:opacity-85 self-start"
                style={{ background: "#174717", color: "#B7EE7A" }}
              >
                Get early access
              </Link>
              <Link
                href="/agents"
                className="text-[0.85rem] font-semibold transition-opacity hover:opacity-70"
                style={{ color: "#174717" }}
              >
                Find an agent
              </Link>
            </div>
          </div>

          {/* Business */}
          <div ref={rightRef} className="rounded-2xl p-8 flex flex-col gap-6" style={{ background: "#174717" }}>
            <div>
              <div className="text-[0.72rem] font-bold tracking-[0.12em] uppercase mb-3" style={{ color: "#B7EE7A" }}>
                Business
              </div>
              <h3 className="font-black leading-tight mb-2" style={{ fontSize: "1.5rem", color: "#ffffff", letterSpacing: "-0.03em" }}>
                Built for<br />real business.
              </h3>
              <p className="text-[0.875rem] leading-[1.6]" style={{ color: "rgba(255,255,255,0.65)" }}>
                Powerful APIs, instant payouts, and compliance tools built for African commerce.
              </p>
            </div>

            <ul className="flex flex-col gap-2.5">
              {BUSINESS.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[0.875rem]" style={{ color: "rgba(255,255,255,0.85)" }}>
                  <CheckIcon light />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="https://merchants.aza.systems"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[0.875rem] font-semibold transition-opacity hover:opacity-85 mt-auto self-start"
              style={{ background: "#B7EE7A", color: "#174717" }}
            >
              Open merchant account
            </a>
          </div>

        </div>
      </div>

      <style>{`
        @media (max-width: 680px) {
          .merchant-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .merchant-grid > * { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
}
