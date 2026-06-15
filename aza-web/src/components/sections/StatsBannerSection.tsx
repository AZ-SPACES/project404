"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { value: "₵0", label: "Transfer fees" },
  { value: "<2s", label: "To any Aza user" },
  { value: "256‑bit", label: "AES encryption" },
  { value: "E2EE", label: "Encrypted chat" },
];

export function StatsBannerSection() {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = rowRef.current?.querySelectorAll<HTMLElement>(".stat-item");
    if (!items) return;
    gsap.fromTo(
      items,
      { y: 24, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: rowRef.current,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );
  }, []);

  return (
    <section aria-label="Key statistics" style={{ background: "#f5f5f7" }}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-16">
        <div ref={rowRef} className="stats-row flex items-center justify-around gap-8 flex-wrap">
          {STATS.map((s, i) => (
            <div key={s.label} className="stat-item flex items-center gap-8 min-w-0">
              <div className="text-center min-w-[120px]">
                <div
                  className="font-black tracking-tight leading-none mb-2"
                  style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", color: "#174717" }}
                >
                  {s.value}
                </div>
                <div className="text-[0.82rem] font-medium" style={{ color: "#6e6e73" }}>
                  {s.label}
                </div>
              </div>
              {i < STATS.length - 1 && (
                <div
                  className="stat-divider hidden md:block h-12 w-px shrink-0"
                  style={{ background: "rgba(0,0,0,0.1)" }}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .stats-row { justify-content: center; gap: 2rem 4rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-item { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
}
