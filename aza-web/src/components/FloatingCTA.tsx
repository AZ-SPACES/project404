"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function FloatingCTA() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dismissed) return;
    const onScroll = () => {
      setVisible(window.scrollY > 640);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div
      ref={btnRef}
      className="floating-cta fixed bottom-6 right-6 z-50 flex items-center gap-3"
      style={{
        transform: visible ? "translateY(0)" : "translateY(80px)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
      aria-hidden={!visible}
    >
      <Link
        href="/#waitlist"
        className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-[0.875rem] font-semibold shadow-lg"
        style={{ background: "#174717", color: "#B7EE7A" }}
        tabIndex={visible ? 0 : -1}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Join waitlist
      </Link>

      <button
        onClick={() => setDismissed(true)}
        className="w-8 h-8 flex items-center justify-center rounded-xl shadow-md transition-opacity hover:opacity-70"
        style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)" }}
        aria-label="Dismiss"
        tabIndex={visible ? 0 : -1}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 2l6 6M8 2l-6 6" stroke="#1d1d1f" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .floating-cta { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
