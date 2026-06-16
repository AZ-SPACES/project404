"use client";

import { useEffect, useRef, useState } from "react";
import Image, { StaticImageData } from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import photo1 from "@/app/assets/photo-1.png";
import photo2 from "@/app/assets/photo-2.png";
import photo3 from "@/app/assets/photo-3.png";
import photo4 from "@/app/assets/photo-4.png";

gsap.registerPlugin(ScrollTrigger);

const SCREENS: { label: string; photo: StaticImageData; desc: string }[] = [
  { label: "Send money", photo: photo1, desc: "Two taps. Any contact. Under 2 seconds." },
  { label: "Mini apps", photo: photo2, desc: "60+ apps. No installs. No new accounts." },
  { label: "Pay in chat", photo: photo3, desc: "Money in the message. Zero friction." },
  { label: "Scan & pay", photo: photo4, desc: "Point. Tap. Done. Any merchant, anywhere." },
];

export function DemoSection() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (idx: number) => {
    if (idx === active || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setActive(idx);
      setAnimating(false);
    }, 220);
  };

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % SCREENS.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        phoneRef.current,
        { y: 48, opacity: 0, scale: 0.9 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1.0,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const screen = SCREENS[active];

  return (
    <section ref={sectionRef} id="demo" className="section-py overflow-hidden" style={{ background: "#1d1d1f" }}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 flex flex-col items-center">

        <div className="text-center mb-14 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#ffffff" }}>
            See it in action.
          </h2>
          <p className="apple-body max-w-[380px] mx-auto" style={{ color: "rgba(255,255,255,0.55)" }}>
            {screen.desc}
          </p>
        </div>

        {/* Phone */}
        <div ref={phoneRef} className="phone-device demo-phone mb-10" aria-label={`Showing: ${screen.label}`}>
          <div className="phone-btn phone-btn--mute" />
          <div className="phone-btn phone-btn--vol-up" />
          <div className="phone-btn phone-btn--vol-dn" />
          <div className="phone-btn phone-btn--power" />
          <div className="phone-screen">
            <div
              className="absolute inset-0 transition-opacity"
              style={{ opacity: animating ? 0 : 1, transitionDuration: "220ms" }}
            >
              <Image
                src={screen.photo}
                alt={screen.label}
                fill
                sizes="268px"
                style={{ objectFit: "cover", objectPosition: "top" }}
                priority
              />
            </div>
            <div className="phone-home-bar" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1" role="tablist" aria-label="App screens">
          {SCREENS.map((s, i) => (
            <button
              key={s.label}
              role="tab"
              aria-selected={i === active}
              onClick={() => {
                if (intervalRef.current) clearInterval(intervalRef.current);
                goTo(i);
                intervalRef.current = setInterval(() => {
                  setActive((prev) => (prev + 1) % SCREENS.length);
                }, 3000);
              }}
              className="px-4 py-2 rounded-xl text-[0.8rem] font-semibold transition-all"
              style={{
                background: i === active ? "rgba(255,255,255,0.12)" : "transparent",
                color: i === active ? "#ffffff" : "rgba(255,255,255,0.4)",
                border: "1px solid " + (i === active ? "rgba(255,255,255,0.2)" : "transparent"),
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

      </div>

      <style>{`
        .demo-phone.phone-device {
          --phone-scale: 1;
        }
        @media (max-width: 480px) {
          .demo-phone.phone-device { transform: scale(0.85); transform-origin: center top; }
        }
        @media (prefers-reduced-motion: reduce) {
          .demo-phone { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
}
