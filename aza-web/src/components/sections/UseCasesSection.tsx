"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const CASES = [
  {
    id: "request",
    who: "Friends",
    title: "You covered the bill. Ask for your share — right there in the chat.",
    desc: "Send a payment request inside the same thread where you planned the night. One tap to pay it back.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="20" height="18" rx="2.5" stroke="#174717" strokeWidth="1.8" fill="rgba(23,71,23,0.08)" />
        <path d="M9 12h10M9 16h6" stroke="#174717" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="21" cy="8" r="4" fill="#B7EE7A" stroke="#174717" strokeWidth="1.2" />
        <path d="M21 6.5v3M19.5 8h3" stroke="#174717" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    bg: "#ffffff",
  },
  {
    id: "instant",
    who: "Everyday",
    title: "Someone needs money now. Not in 3 hours — right now.",
    desc: "Search a contact, enter an amount, confirm. Aza delivers in under 2 seconds, zero fees.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="14" r="10" stroke="#174717" strokeWidth="1.8" fill="rgba(23,71,23,0.08)" />
        <path d="M14 9v5l3 3" stroke="#174717" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 4.5L14 3l4 1.5" stroke="#174717" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    bg: "#f5f5f7",
  },
  {
    id: "supplier",
    who: "Business owners",
    title: "Invoice received. Paid. Your vendor confirms before they hang up.",
    desc: "Instant business payments with transaction records, notes, and receipts built in.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="5" y="4" width="14" height="18" rx="2" stroke="#174717" strokeWidth="1.8" fill="rgba(23,71,23,0.08)" />
        <path d="M9 9h6M9 13h4" stroke="#174717" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 16l4 4m0-4l-4 4" stroke="#174717" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="21" cy="20" r="3.5" stroke="#174717" strokeWidth="1.3" />
        <path d="M20 20l.75.75L22 19" stroke="#174717" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    bg: "#ffffff",
  },
  {
    id: "shop",
    who: "Shoppers",
    title: "Scan the QR. Pay. No card details. No OTP wait. No friction.",
    desc: "Works at any merchant showing an Aza QR — from street food to e-commerce checkout.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="#174717" strokeWidth="1.8" fill="rgba(23,71,23,0.08)" />
        <rect x="16" y="4" width="8" height="8" rx="1.5" stroke="#174717" strokeWidth="1.8" fill="rgba(23,71,23,0.08)" />
        <rect x="4" y="16" width="8" height="8" rx="1.5" stroke="#174717" strokeWidth="1.8" fill="rgba(23,71,23,0.08)" />
        <rect x="6.5" y="6.5" width="3" height="3" rx="0.5" fill="#174717" />
        <rect x="18.5" y="6.5" width="3" height="3" rx="0.5" fill="#174717" />
        <rect x="6.5" y="18.5" width="3" height="3" rx="0.5" fill="#174717" />
        <path d="M16 16h3v3h-3z" fill="#174717" />
        <path d="M21 16h3v3h-3z" fill="rgba(23,71,23,0.3)" />
        <path d="M16 21h3v3h-3z" fill="rgba(23,71,23,0.3)" />
        <path d="M21 21h3v3h-3z" fill="#174717" />
      </svg>
    ),
    bg: "#f5f5f7",
  },
  {
    id: "budget",
    who: "Budgeters",
    title: "Set a limit per category. Get a nudge before you blow it.",
    desc: "Monthly budgets by spending category, plus AI-generated insights on what each transfer means for your habits.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M14 4a10 10 0 1 0 7.07 2.93" stroke="#174717" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M14 4v6l5 3" stroke="#174717" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="rgba(23,71,23,0.08)" />
        <circle cx="14" cy="14" r="2" fill="#B7EE7A" stroke="#174717" strokeWidth="1.2" />
      </svg>
    ),
    bg: "#ffffff",
  },
  {
    id: "recurring",
    who: "Power users",
    title: "Rent, subscriptions, savings — set once, sent every month.",
    desc: "Schedule a recurring transfer to anyone and Aza sends it automatically, on time, every cycle.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M21 8a8 8 0 1 0 1.7 6" stroke="#174717" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M22 4v4.5h-4.5" stroke="#174717" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    bg: "#f5f5f7",
  },
];

export function UseCasesSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current?.querySelectorAll<HTMLElement>(".usecase-card");
    if (!cards) return;
    gsap.fromTo(
      cards,
      { y: 36, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.75,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, []);

  return (
    <section id="use-cases" className="apple-light section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        <div className="text-center mb-12 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            Made for your<br />real life.
          </h2>
          <p className="apple-body max-w-[420px] mx-auto" style={{ color: "#6e6e73" }}>
            Wherever money moves in your world — Aza moves with it.
          </p>
        </div>

        <div ref={gridRef} className="use-cases-grid grid gap-4" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {CASES.map((c) => (
            <div
              key={c.id}
              className="usecase-card rounded-2xl p-7 flex flex-col gap-4"
              style={{
                background: c.bg,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(23,71,23,0.06)" }}
                >
                  {c.icon}
                </div>
                <div
                  className="text-[0.7rem] font-bold tracking-[0.12em] uppercase self-center"
                  style={{ color: "#174717" }}
                >
                  {c.who}
                </div>
              </div>
              <h3
                className="font-semibold leading-snug"
                style={{ fontSize: "1.05rem", color: "#1d1d1f", letterSpacing: "-0.025em" }}
              >
                {c.title}
              </h3>
              <p className="text-[0.875rem] leading-[1.65]" style={{ color: "#6e6e73" }}>
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .use-cases-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .usecase-card { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
}
