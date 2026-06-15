"use client";

import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";

const steps = [
  {
    num: "1",
    title: "Download & sign up",
    desc: "Install Aza and create your account with your phone number. Two minutes, no paperwork.",
    visual: (
      <div className="flex flex-col gap-2 p-4 select-none h-full" aria-hidden="true">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black shadow-sm" style={{ background: "#174717", color: "#B7EE7A" }}>A</div>
          <div>
            <div className="text-[0.8rem] font-semibold" style={{ color: "#1d1d1f" }}>Aza</div>
            <div className="text-[0.65rem]" style={{ color: "#6e6e73" }}>Finance · Free</div>
          </div>
          <div className="ml-auto px-3 py-1 rounded-lg text-[0.72rem] font-bold" style={{ background: "#174717", color: "#B7EE7A" }}>GET</div>
        </div>
        <div className="rounded-xl px-3 py-2.5 text-[0.75rem]" style={{ background: "#f5f5f7", color: "#6e6e73" }}>+233 · Enter phone number</div>
        <div className="rounded-xl px-3 py-2.5 text-[0.75rem] font-bold text-center" style={{ background: "#174717", color: "#B7EE7A" }}>Create account →</div>
      </div>
    ),
  },
  {
    num: "2",
    title: "Verify your identity",
    desc: "Quick KYC with your Ghana Card or passport. End-to-end encrypted.",
    visual: (
      <div className="relative w-full h-full select-none overflow-hidden" aria-hidden="true">
        <Image
          src="/ghana-card.png"
          alt="Ghana National ID Card"
          fill
          sizes="320px"
          style={{ objectFit: "cover", objectPosition: "center 30%" }}
          priority
        />
        {/* Verified badge overlay */}
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.68rem] font-bold shadow-sm"
          style={{ background: "#fff", color: "#174717", border: "1px solid rgba(23,71,23,0.15)" }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4" stroke="#174717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Verified
        </div>
      </div>
    ),
  },
  {
    num: "3",
    title: "Send & receive instantly",
    desc: "You're ready. Send money, request payments, chat, scan QR codes — all in one place.",
    visual: (
      <div className="flex flex-col gap-2 p-4 select-none h-full" aria-hidden="true">
        <div className="text-center mb-1">
          <div className="text-[0.65rem]" style={{ color: "#6e6e73" }}>Available balance</div>
          <div className="text-[1.5rem] font-black tracking-tight" style={{ color: "#1d1d1f" }}>₵ 1,250.00</div>
        </div>
        <div className="flex gap-2 justify-center">
          {["Send", "Request", "Scan"].map((a) => (
            <div key={a} className="px-3 py-1.5 rounded-lg text-[0.7rem] font-semibold" style={{ background: a === "Send" ? "#174717" : "#f5f5f7", color: a === "Send" ? "#B7EE7A" : "#1d1d1f" }}>{a}</div>
          ))}
        </div>
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-[0.7rem]" style={{ background: "#f5f5f7" }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-bold" style={{ background: "#174717", color: "#B7EE7A" }}>K</div>
          <span style={{ color: "#1d1d1f" }}>Kofi Mensah</span>
          <span className="ml-auto font-bold" style={{ color: "#34a853" }}>+₵120</span>
        </div>
      </div>
    ),
  },
];

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 20px rgba(0,0,0,0.06)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.6s cubic-bezier(0.22,1,0.36,1) ${index * 110}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${index * 110}ms`,
        minHeight: "300px",
      }}
    >
      {/* Step number */}
      <div
        className="absolute top-4 right-5 text-[4.5rem] font-black leading-none select-none pointer-events-none"
        style={{ color: "rgba(0,0,0,0.04)", letterSpacing: "-0.05em" }}
        aria-hidden="true"
      >
        {step.num}
      </div>

      {/* Visual preview */}
      <div className="h-[180px] relative overflow-hidden flex flex-col justify-end" style={{ background: "#f5f5f7", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        {step.visual}
      </div>

      {/* Text */}
      <div className="p-5 flex-1">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mb-3"
          style={{ background: "#174717", color: "#B7EE7A" }}
        >
          {step.num}
        </div>
        <h3 className="font-bold mb-1.5 leading-snug" style={{ fontSize: "1rem", color: "#1d1d1f", letterSpacing: "-0.02em" }}>
          {step.title}
        </h3>
        <p className="text-[0.85rem] leading-[1.6]" style={{ color: "#6e6e73" }}>
          {step.desc}
        </p>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="apple-light section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        {/* Centered heading */}
        <div className="text-center mb-12 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            Up and running<br />in minutes.
          </h2>
          <p className="apple-body max-w-[420px] mx-auto" style={{ color: "#6e6e73" }}>
            Three steps. No queues. No branch visits. Just your phone.
          </p>
        </div>

        <div className="hiw-cards flex gap-4 items-stretch">
          {steps.map((s, i) => <StepCard key={s.num} step={s} index={i} />)}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) { .hiw-cards { flex-direction: column !important; } }
        @media (prefers-reduced-motion: reduce) { .hiw-cards > * { opacity: 1 !important; transform: none !important; transition: none !important; } }
      `}</style>
    </section>
  );
}
