"use client";

import React from "react";

/* ── Send Money illustration ── */
function SendIllustration() {
  return (
    <div className="relative w-full h-[110px] mt-auto select-none" aria-hidden="true">
      <div className="absolute left-0 bottom-0 flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "rgba(183,238,122,0.15)", color: "#B7EE7A" }}>K</div>
        <span className="text-[0.6rem]" style={{ color: "#6e6e73" }}>Kwame</span>
      </div>
      <div className="absolute left-[52px] right-[52px] top-1/2 -translate-y-3 flex items-center">
        <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(183,238,122,0.2), rgba(183,238,122,0.6))" }} />
        <div className="relative shrink-0 mx-1">
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[0.65rem] font-black whitespace-nowrap"
            style={{ background: "#B7EE7A", color: "#174717" }}
          >
            ₵ 250
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="#B7EE7A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(183,238,122,0.6), rgba(183,238,122,0.2))" }} />
      </div>
      <div className="absolute right-0 bottom-0 flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "#B7EE7A", color: "#174717" }}>A</div>
        <span className="text-[0.6rem]" style={{ color: "#6e6e73" }}>Abena</span>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 text-[0.6rem]" style={{ color: "#6e6e73" }}>Done in &lt;2s</div>
    </div>
  );
}

/* ── Request / Split illustration ── */
function SplitIllustration() {
  return (
    <div className="mt-auto select-none" aria-hidden="true">
      <div
        className="rounded-2xl p-3.5 text-[0.75rem]"
        style={{ background: "rgba(183,238,122,0.07)", border: "1px solid rgba(183,238,122,0.15)" }}
      >
        <div className="flex justify-between items-start mb-3">
          <span className="font-semibold" style={{ color: "#f5f5f7" }}>Split: Dinner 🍽</span>
          <span className="font-black" style={{ color: "#B7EE7A" }}>₵ 180</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ n: "You", me: true }, { n: "Kofi" }, { n: "Ama" }, { n: "Yaw" }].map(({ n, me }) => (
            <div
              key={n}
              className="px-2.5 py-1 rounded-full text-[0.65rem] font-semibold"
              style={{ background: me ? "#B7EE7A" : "rgba(255,255,255,0.06)", color: me ? "#174717" : "#86868b" }}
            >
              {n}
            </div>
          ))}
        </div>
        <div className="mt-2.5 pt-2.5 text-[0.65rem]" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "#6e6e73" }}>
          Each owes ₵45 · 3 pending
        </div>
      </div>
    </div>
  );
}

/* ── Chat illustration ── */
function ChatIllustration() {
  return (
    <div className="mt-auto space-y-2 select-none" aria-hidden="true">
      <div className="flex justify-end">
        <div className="px-3 py-2 rounded-2xl rounded-br-sm text-[0.72rem]" style={{ background: "#174717", color: "#fff", maxWidth: "80%" }}>
          Sent you ₵50 🎉
          <div className="text-[0.6rem] mt-0.5 text-right" style={{ color: "rgba(255,255,255,0.35)" }}>✓✓ 2:14 PM</div>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="px-3 py-2 rounded-2xl rounded-bl-sm text-[0.72rem]" style={{ background: "rgba(255,255,255,0.07)", color: "#f5f5f7", maxWidth: "80%" }}>
          Got it, thanks! 🙌
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    key: "send",
    title: "Send Money",
    desc: "Search a name, enter an amount, confirm. Done in under 2 seconds.",
    large: true,
    illustration: <SendIllustration />,
    accentBg: "rgba(183,238,122,0.06)",
    accentBorder: "rgba(183,238,122,0.12)",
  },
  {
    key: "request",
    title: "Request & Split",
    desc: "Split bills instantly. Add a note — no awkward follow-ups.",
    large: true,
    illustration: <SplitIllustration />,
    accentBg: "rgba(255,255,255,0.03)",
    accentBorder: "rgba(255,255,255,0.06)",
  },
  {
    key: "chat",
    title: "Pay in Chat",
    desc: "Message and send money in the same thread.",
    large: false,
    illustration: <ChatIllustration />,
    accentBg: "rgba(255,255,255,0.03)",
    accentBorder: "rgba(255,255,255,0.06)",
  },
  {
    key: "scan",
    title: "Scan & Pay",
    desc: "QR codes — scan to pay, share yours to receive.",
    large: false,
    illustration: (
      <div className="flex justify-center mt-auto select-none" aria-hidden="true">
        <div className="w-12 h-12 rounded-lg p-2 relative" style={{ background: "rgba(255,255,255,0.05)" }}>
          {[
            "top-0 left-0 border-t border-l",
            "top-0 right-0 border-t border-r",
            "bottom-0 left-0 border-b border-l",
          ].map((cls) => (
            <div key={cls} className={`absolute ${cls} w-2.5 h-2.5 m-1`} style={{ borderColor: "#B7EE7A", borderWidth: "1.5px" }} />
          ))}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded flex items-center justify-center text-[0.45rem] font-black" style={{ background: "#174717", color: "#B7EE7A" }}>A</div>
        </div>
      </div>
    ),
    accentBg: "rgba(255,255,255,0.03)",
    accentBorder: "rgba(255,255,255,0.06)",
  },
  {
    key: "hub",
    title: "Mini-App Hub",
    desc: "Finance, games, and more — built right in.",
    large: false,
    illustration: (
      <div className="grid grid-cols-3 gap-1.5 mt-auto select-none" aria-hidden="true">
        {["₵", "🎮", "📻", "📝", "📈", "🔗"].map((ic, i) => (
          <div key={i} className="h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: "rgba(255,255,255,0.06)" }}>{ic}</div>
        ))}
      </div>
    ),
    accentBg: "rgba(255,255,255,0.03)",
    accentBorder: "rgba(255,255,255,0.06)",
  },
  {
    key: "notify",
    title: "Instant Alerts",
    desc: "Every transfer and message lands in real time.",
    large: false,
    illustration: (
      <div className="space-y-1.5 mt-auto select-none" aria-hidden="true">
        {["₵120 received from Kofi", "Abena requested ₵80"].map((t) => (
          <div key={t} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[0.68rem]" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#B7EE7A" }} />
            <span style={{ color: "#86868b" }} className="truncate">{t}</span>
          </div>
        ))}
      </div>
    ),
    accentBg: "rgba(255,255,255,0.03)",
    accentBorder: "rgba(255,255,255,0.06)",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="apple-dark section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        {/* Section heading — centered Apple style */}
        <div className="text-center mb-14 reveal">
          <h2 className="apple-headline text-white mb-4">
            Everything you need.<br />
            <span style={{ color: "#86868b" }}>Nothing you don&rsquo;t.</span>
          </h2>
          <p className="apple-body max-w-[480px] mx-auto" style={{ color: "#6e6e73" }}>
            From instant transfers to built-in chat — Aza packs your entire financial life into one seamless app.
          </p>
        </div>

        {/* Bento grid */}
        <div className="features-bento grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {features.map((f, i) => (
            <div
              key={f.key}
              className="reveal rounded-2xl p-5 flex flex-col"
              data-delay={String(i * 50)}
              style={{
                gridColumn: f.large ? "span 2" : "span 1",
                minHeight: f.large ? "260px" : "220px",
                background: f.accentBg,
                border: `1px solid ${f.accentBorder}`,
              }}
            >
              <h3 className="apple-title mb-2" style={{ color: "#f5f5f7", fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
                {f.title}
              </h3>
              <p className="text-[0.85rem] leading-[1.6]" style={{ color: "#6e6e73" }}>
                {f.desc}
              </p>
              {f.illustration}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
