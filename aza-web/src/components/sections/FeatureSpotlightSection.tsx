"use client"

import { useEffect, useRef } from "react"
import Image, { StaticImageData } from "next/image"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import photo1 from "@/app/assets/photo-1.png"
import photo2 from "@/app/assets/photo-2.png"
import photo3 from "@/app/assets/photo-3.png"
import photo4 from "@/app/assets/photo-4.png"

gsap.registerPlugin(ScrollTrigger)

interface FeatureData {
  key: string
  num: string
  title: string
  sub: string
  desc: string
  photo: StaticImageData
  reverse: boolean
  tag: string
  bg: string
}

const FEATURES: FeatureData[] = [
  {
    key: "send",
    num: "01",
    title: "Send money.",
    sub: "Done in two taps.",
    desc: "Search a contact, enter an amount, confirm. Under 2 seconds — no fees, no friction, no queue.",
    photo: photo1,
    reverse: false,
    tag: "Zero fees",
    bg: "#ffffff",
  },
  {
    key: "hub",
    num: "02",
    title: "Mini apps.",
    sub: "Everything in one place.",
    desc: "Games, financial tools, entertainment — all running inside Aza. No installs, no new accounts, no switching apps.",
    photo: photo2,
    reverse: true,
    tag: "10+ apps",
    bg: "#f5f5f7",
  },
  {
    key: "chat",
    num: "03",
    title: "Pay in chat.",
    sub: "Money in the conversation.",
    desc: "Send money in the same thread as your messages. No app switching. No payment links. Just tap.",
    photo: photo3,
    reverse: false,
    tag: "Contextual payments",
    bg: "#ffffff",
  },
  {
    key: "scan",
    num: "04",
    title: "Scan and pay.",
    sub: "Point. Tap. Done.",
    desc: "Any QR code, anywhere. Scan to pay merchants. Share yours to get paid. Instant confirmation.",
    photo: photo4,
    reverse: true,
    tag: "Universal QR",
    bg: "#f5f5f7",
  },
]

function FeaturePhone({ photo, alt }: { photo: StaticImageData; alt: string }) {
  return (
    <div className="phone-device" aria-hidden="true">
      <div className="phone-btn phone-btn--mute" />
      <div className="phone-btn phone-btn--vol-up" />
      <div className="phone-btn phone-btn--vol-dn" />
      <div className="phone-btn phone-btn--power" />
      <div className="phone-screen">
        <div className="absolute inset-0">
          <Image
            src={photo}
            alt={alt}
            fill
            sizes="268px"
            style={{ objectFit: "cover", objectPosition: "top" }}
          />
        </div>
        <div className="phone-home-bar" />
      </div>
    </div>
  )
}

function FeatureBlock({ f, i }: { f: FeatureData; i: number }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = gsap.context(() => {
      const tx = f.reverse ? 56 : -56

      gsap.fromTo(
        textRef.current,
        { x: tx, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.95,
          ease: "power3.out",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 78%",
            toggleActions: "play none none none",
          },
        }
      )

      gsap.fromTo(
        phoneRef.current,
        { x: -tx, opacity: 0, scale: 0.88 },
        {
          x: 0,
          opacity: 1,
          scale: 1,
          duration: 1.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 78%",
            toggleActions: "play none none none",
          },
        }
      )
    }, rootRef)

    return () => ctx.revert()
  }, [f.reverse])

  return (
    <div style={{ background: f.bg }}>
      {i > 0 && (
        <div className="max-w-[1080px] mx-auto px-6">
          <div style={{ height: "1px", background: "rgba(0,0,0,0.07)" }} />
        </div>
      )}

      <div
        ref={rootRef}
        className="spotlight-block max-w-[1080px] mx-auto px-6 flex items-center gap-16 py-28"
        style={{ flexDirection: f.reverse ? "row-reverse" : "row" }}
      >
        {/* Text */}
        <div ref={textRef} className="flex-1 min-w-0">
          <p
            className="text-[0.7rem] font-bold tracking-[0.15em] uppercase mb-6"
            style={{ color: "#174717" }}
          >
            {f.num} — {f.tag}
          </p>
          <h2 className="apple-headline mb-5" style={{ color: "#1d1d1f" }}>
            {f.title}
          </h2>
          <p
            className="mb-6"
            style={{
              color: "#6e6e73",
              fontSize: "clamp(1.1rem, 2vw, 1.5rem)",
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.3,
            }}
          >
            {f.sub}
          </p>
          <p className="apple-body max-w-[420px]" style={{ color: "#6e6e73" }}>
            {f.desc}
          </p>
        </div>

        {/* Phone */}
        <div ref={phoneRef} className="spotlight-phone-wrap flex-shrink-0">
          <div className="spotlight-phone-glow">
            <FeaturePhone photo={f.photo} alt={f.sub} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function FeatureSpotlightSection() {
  return (
    <section id="features">
      {/* Intro — white bg */}
      <div className="text-center px-6 pt-[100px] pb-20 reveal" style={{ background: "#ffffff" }}>
        <h2 className="apple-headline mb-5" style={{ color: "#1d1d1f" }}>
          Everything you need.<br />
          <span style={{ color: "#6e6e73" }}>Nothing you don&rsquo;t.</span>
        </h2>
        <p className="apple-body max-w-[460px] mx-auto" style={{ color: "#6e6e73" }}>
          From instant transfers to built-in chat — your entire financial life in one app.
        </p>
      </div>

      {/* Feature blocks */}
      {FEATURES.map((f, i) => (
        <FeatureBlock key={f.key} f={f} i={i} />
      ))}

      <style>{`
        @media (max-width: 800px) {
          .spotlight-block {
            flex-direction: column !important;
            gap: 2.5rem;
            padding-top: 4rem;
            padding-bottom: 4rem;
          }
          .spotlight-phone-wrap { order: -1; }
        }
        @media (max-width: 400px) {
          .spotlight-block .phone-device { transform: scale(0.82); transform-origin: center top; }
        }
        .spotlight-phone-glow {
          position: relative;
        }
        .spotlight-phone-glow::before {
          content: '';
          position: absolute;
          inset: -40px;
          background: radial-gradient(circle at 50% 60%, rgba(23,71,23,0.06) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: -1;
        }
      `}</style>
    </section>
  )
}
