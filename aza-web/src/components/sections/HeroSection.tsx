"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PhoneMockup } from "@/components/phone/PhoneMockup";

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const phoneWrapRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.to(phoneWrapRef.current, {
        y: -55,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1.6,
        },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="home"
      className="apple-dark relative overflow-hidden"
      style={{ paddingTop: "calc(14px + 44px + 100px)", paddingBottom: "0" }}
    >
      {/* Subtle green glow behind phone */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center bottom, rgba(23,71,23,0.07) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      {/* Text block — centered */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 sm:px-6">

        {/* Display headline */}
        <h1
          className="reveal apple-display mb-6 max-w-[820px]"
          data-delay="60"
          style={{ color: "#1d1d1f" }}
        >
          The money app<br />
          <span style={{ color: "#174717" }}>built for Africa.</span>
        </h1>

        {/* Subtitle */}
        <p
          className="reveal apple-body max-w-[480px] mb-10"
          data-delay="120"
          style={{ color: "#6e6e73" }}
        >
          Send and receive money instantly. Chat with friends. Scan QR codes.
          All in one app — secured with bank-level encryption.
        </p>

        {/* CTAs */}
        <div className="reveal flex gap-3 flex-wrap justify-center mb-16" data-delay="180">
          <Link
            href="/#waitlist"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-[0.95rem] font-semibold transition-opacity hover:opacity-85"
            style={{ background: "#B7EE7A", color: "#174717" }}
          >
            Join the waitlist
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-[0.95rem] font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "transparent",
              color: "#174717",
              border: "1.5px solid rgba(23,71,23,0.3)",
            }}
          >
            Learn more
          </Link>
        </div>
      </div>

      {/* Phone mockup */}
      <div
        ref={phoneWrapRef}
        className="reveal-scale relative z-10 flex justify-center hero-phone-wrap"
        data-delay="80"
        style={{ marginBottom: "-60px" }}
      >
        <div className="hero-phone-scale">
          <PhoneMockup hideDots />
        </div>
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-[0.6rem] font-semibold tracking-[0.2em] uppercase" style={{ color: "#c7c7cc" }}>
          Scroll
        </span>
        <svg
          className="hero-scroll-chevron"
          width="16"
          height="9"
          viewBox="0 0 16 9"
          fill="none"
        >
          <path
            d="M1 1l7 7 7-7"
            stroke="#c7c7cc"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
}
