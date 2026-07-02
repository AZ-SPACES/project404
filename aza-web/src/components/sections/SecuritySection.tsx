"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Fingerprint, ShieldCheck, Smartphone } from "lucide-react";

const items = [
  { icon: <Lock size={18} />,        title: "End-to-End Encryption",    desc: "Every message and transaction is fully encrypted in transit and at rest." },
  { icon: <Fingerprint size={18} />, title: "Biometric Authentication",  desc: "Face ID and fingerprint login keep your account locked to you — literally." },
  { icon: <ShieldCheck size={18} />, title: "KYC Verification",          desc: "We verify every user with ID and face scan so your money only goes where you send it." },
  { icon: <Smartphone size={18} />,  title: "Device Management",         desc: "Monitor and control all devices logged into your account from one place." },
];

const badges = ["256-bit AES", "TLS 1.3", "2FA", "Biometrics", "KYC", "PEP Screening"];

function LiveSecurityPanel() {
  const [scanY, setScanY] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let start: number | null = null;
    function tick(ts: number) {
      if (!start) start = ts;
      const elapsed = ts - start;
      setScanY((elapsed % 2400) / 2400 * 100);
      setActiveIdx(Math.floor(elapsed / 1600) % badges.length);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      className="relative rounded-3xl overflow-hidden flex flex-col items-center justify-center gap-6 p-8"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.06)",
        minHeight: "380px",
      }}
    >
      {/* Scan line */}
      <div
        className="absolute inset-x-0 h-px pointer-events-none"
        style={{ top: `${scanY}%`, background: "linear-gradient(90deg, transparent, rgba(23,71,23,0.35), transparent)", boxShadow: "0 0 10px rgba(23,71,23,0.15)" }}
        aria-hidden="true"
      />
      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.6,
        }}
        aria-hidden="true"
      />

      {/* Shield */}
      <div className="relative z-10">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(23,71,23,0.07)", border: "1px solid rgba(23,71,23,0.18)" }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-label="Security shield">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="#174717" strokeWidth="1.5" fill="rgba(23,71,23,0.07)" />
            <path d="M9 12l2 2 4-4" stroke="#174717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {[1, 2].map((r) => (
          <div key={r} className="absolute inset-0" style={{ margin: `-${r * 10}px`, borderRadius: "calc(1rem + 10px)", border: "1px solid rgba(23,71,23,0.12)", animation: `secRing 2.4s ease-out ${r * 0.4}s infinite` }} aria-hidden="true" />
        ))}
      </div>

      {/* Status */}
      <div className="relative z-10 text-center">
        <p className="font-bold text-[1rem] mb-1" style={{ color: "#1d1d1f" }}>Protected by design</p>
        <p className="text-[0.75rem]" style={{ color: "#6e6e73" }}>All systems nominal</p>
      </div>

      {/* Badges */}
      <div className="relative z-10 flex flex-wrap gap-2 justify-center max-w-[260px]">
        {badges.map((b, i) => (
          <span
            key={b}
            className="px-3 py-1 rounded-lg text-[0.72rem] font-semibold transition-[background-color,color,border-color,transform] duration-300"
            style={{
              background: i === activeIdx ? "rgba(23,71,23,0.1)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${i === activeIdx ? "rgba(23,71,23,0.3)" : "rgba(0,0,0,0.08)"}`,
              color: i === activeIdx ? "#174717" : "#6e6e73",
              transform: i === activeIdx ? "scale(1.05)" : "scale(1)",
            }}
          >
            {b}
          </span>
        ))}
      </div>

      {/* Live status table */}
      <div
        className="relative z-10 w-full rounded-2xl p-3 text-[0.7rem] space-y-2"
        style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}
        aria-hidden="true"
      >
        {[
          { label: "Encryption", status: "AES-256 active" },
          { label: "Auth layer", status: "2FA + biometric" },
          { label: "Connection", status: "TLS 1.3 secured" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span style={{ color: "#6e6e73" }}>{row.label}</span>
            <span className="flex items-center gap-1.5" style={{ color: "#174717" }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#174717" }} />
              {row.status}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes secRing { 0% { opacity: 0.7; transform: scale(1); } 100% { opacity: 0; transform: scale(1.6); } }
        @media (prefers-reduced-motion: reduce) { @keyframes secRing { 0%, 100% { opacity: 0; } } }
      `}</style>
    </div>
  );
}

export function SecuritySection() {
  return (
    <section id="security" className="apple-light section-py">
      <div className="security-grid max-w-[1080px] mx-auto px-4 sm:px-6 grid gap-12 lg:gap-20 items-center" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* Content */}
        <div className="reveal-x-left">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            Your money is<br />
            <span style={{ color: "#6e6e73" }}>safe with us.</span>
          </h2>
          <p className="apple-body mb-10" style={{ color: "#6e6e73", maxWidth: "420px" }}>
            Aza uses bank-level security at every layer — from biometrics to end-to-end encryption.
          </p>
          <div className="flex flex-col gap-6">
            {items.map((item, i) => (
              <div key={item.title} className="reveal flex gap-4 items-start" data-delay={String(i * 80 + 200)}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(23,71,23,0.08)", color: "#174717" }}>
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-[0.9rem] mb-0.5" style={{ color: "#1d1d1f", letterSpacing: "-0.01em" }}>{item.title}</h4>
                  <p className="text-[0.85rem] leading-[1.55]" style={{ color: "#6e6e73" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel */}
        <div className="reveal-x-right">
          <LiveSecurityPanel />
        </div>
      </div>
    </section>
  );
}
