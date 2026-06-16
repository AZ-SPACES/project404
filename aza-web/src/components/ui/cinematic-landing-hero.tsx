// src/components/ui/cinematic-landing-hero.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ChevronDown, Mouse } from "lucide-react";

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  tagline1?: string;
  tagline2?: string;
}

export function CinematicHero({
  tagline1 = "Send money.",
  tagline2 = "Effortlessly.",
  className,
  ...props
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [animationDone, setAnimationDone] = useState(false);
  const isVisible = !prefersReducedMotion && !animationDone;

  useEffect(() => {
    // Skip the splash entirely for reduced-motion users — no scroll lock,
    // no multi-second animation holding the page hostage.
    if (prefersReducedMotion) return;

    // Hide navbar and lock scroll while cinematic is active
    document.body.classList.add('cinematic-active');
    document.body.style.overflow = 'hidden';

    const ctx = gsap.context(() => {
      gsap.set(".text-track", {
        autoAlpha: 0,
        y: 60,
        scale: 0.85,
        filter: "blur(20px)",
        rotationX: -20,
      });
      gsap.set(".text-days", {
        autoAlpha: 1,
        clipPath: "inset(0 100% 0 0)",
      });
      gsap.set(".scroll-indicator", {
        autoAlpha: 0,
        y: 20,
      });

      gsap
        .timeline({
          delay: 0.3,
          onComplete: () => {
            // After text animations, animate the entire hero out
            gsap.to(containerRef.current, {
              autoAlpha: 0,
              y: -50,
              duration: 1,
              ease: "power3.inOut",
              delay: 1.5, // Hold the text for a bit before fading out
              onComplete: () => {
                // Restore scroll, reveal navbar, unmount component
                document.body.classList.remove('cinematic-active');
                document.body.style.overflow = '';
                setAnimationDone(true);
              }
            });
          }
        })
        .to(".text-track", {
          duration: 1.8,
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          rotationX: 0,
          ease: "expo.out",
        })
        .to(
          ".text-days",
          {
            duration: 1.4,
            clipPath: "inset(0 0% 0 0)",
            ease: "power4.inOut",
          },
          "-=1.0"
        )
        .to(
          ".scroll-indicator",
          {
            duration: 1,
            autoAlpha: 1,
            y: 0,
            ease: "power2.out",
          },
          "-=0.5"
        );
    }, containerRef);

    return () => {
      ctx.revert();
      document.body.classList.remove('cinematic-active');
      document.body.style.overflow = '';
    };
  }, [prefersReducedMotion]);

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center bg-background text-foreground font-sans antialiased overflow-hidden",
        className
      )}
      style={{ perspective: "1500px" }}
      {...props}
    >
      <div className="film-grain" aria-hidden="true" />
      <div
        className="bg-grid-theme absolute inset-0 z-0 pointer-events-none opacity-50"
        aria-hidden="true"
      />

      {/* Decorative splash — the page's real h1 lives in HeroSection */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full px-4" aria-hidden="true">
        <p className="text-track gsap-reveal text-3d-matte text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tight mb-2">
          {tagline1}
        </p>
        <p className="text-days gsap-reveal text-silver-matte text-5xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter">
          {tagline2}
        </p>
      </div>

      <div className="scroll-indicator absolute bottom-12 z-20 flex flex-col items-center gap-2 text-neutral-500/80 pointer-events-none">
        <Mouse className="w-6 h-6 animate-pulse" aria-hidden="true" />
        <ChevronDown className="w-5 h-5 animate-bounce" aria-hidden="true" />
      </div>
    </div>
  );
}
