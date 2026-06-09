"use client";

import { PhoneMockup } from "@/components/phone/PhoneMockup";

const stats = [
  { value: "₵0",      label: "Hidden fees"  },
  { value: "Instant", label: "Transfers"    },
  { value: "256-bit", label: "AES Encryption" },
];

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden section-py"
      style={{ paddingTop: "calc(14px + 44px + 80px)" }}
      id="home"
    >
      <div
        className="hero-grid max-w-[1160px] mx-auto px-4 sm:px-6 grid gap-12 lg:gap-[80px] items-center"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        {/* Content */}
        <div className="max-w-[520px]">
          <div
            className="reveal inline-flex items-center gap-2 px-[14px] py-[6px] rounded-md text-[0.8rem] font-semibold mb-6"
            style={{
              background: "rgba(183,238,122,0.2)",
              border: "1px solid rgba(183,238,122,0.5)",
              color: "#174717",
            }}
          >
            <span className="badge-dot" />
            Soon available worldwide
          </div>

          <h1
            className="reveal text-[clamp(2.4rem,5vw,3.5rem)] font-extrabold leading-[1.1] tracking-[-0.03em] mb-6"
            data-delay="80"
            style={{ color: "var(--aza-text)" }}
          >
            Send money.<br />
            <span style={{ color: "#B7EE7A" }}>Effortlessly.</span>
          </h1>

          <p
            className="reveal text-[1.1rem] leading-[1.7] mb-8"
            data-delay="160"
            style={{ color: "var(--aza-text-secondary)" }}
          >
            Aza lets you send and request money, chat with friends, scan QR
            codes, and access powerful mini-apps — all in one secure platform.
          </p>

          <div className="hero-cta reveal flex gap-4 flex-wrap mb-8" data-delay="240">
            <a
              href="#download"
              className="inline-flex items-center gap-2 px-[30px] py-[15px] rounded-lg text-[1rem] font-semibold text-white transition-colors"
              style={{ background: "#174717", boxShadow: "0 2px 8px rgba(23,71,23,0.15)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.38.07 2.34.74 3.15.8 1.2-.24 2.35-.93 3.64-.84 1.54.12 2.71.72 3.46 1.83-3.18 1.91-2.5 6.05.82 7.27-.57 1.47-1.3 2.93-2.7 3.82zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Download for iOS
            </a>
            <a
              href="#download"
              className="inline-flex items-center gap-2 px-[30px] py-[15px] rounded-lg text-[1rem] font-semibold transition-colors"
              style={{ background: "transparent", border: "1.5px solid var(--aza-border)", color: "var(--aza-text)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.85c.577.33.702 1.059.318 1.54l-.318.318L15.396 12l2.302-2.302.318.318c-.005-.005.005.005 0 0zM5.864 2.658L16.8 8.99 14.499 11.29 5.864 2.658z" />
              </svg>
              Download for Android
            </a>
          </div>

          {/* Stats */}
          <div className="reveal flex items-center gap-4 sm:gap-6 flex-wrap" data-delay="320">
            {stats.map(({ value, label }, i) => (
              <div key={label} className="flex items-center gap-4 sm:gap-6">
                {i > 0 && <div className="w-px h-9" style={{ background: "var(--aza-border)" }} />}
                <div>
                  <span className="block text-[1.5rem] font-black tracking-[-0.03em]" style={{ color: "var(--aza-text)" }}>
                    {value}
                  </span>
                  <span className="block text-[0.8rem] font-medium" style={{ color: "var(--aza-text-secondary)" }}>
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div className="hero-visual-order reveal-scale flex justify-center items-center relative" data-delay="100">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
