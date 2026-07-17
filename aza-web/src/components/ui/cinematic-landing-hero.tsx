// src/components/ui/cinematic-landing-hero.tsx
"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getLenis } from "@/lib/smooth-scroll-instance";

// The splash is a once-per-session welcome. Returning to "/" via client-side
// navigation (logo, "Back to aza" links, browser back) must NOT replay it —
// otherwise every trip home re-hides the navbar and locks scroll for ~5s.
const SEEN_KEY = "aza-cinematic-seen";

// useLayoutEffect on the client (runs before paint, so a skipped splash never
// flashes), useEffect on the server (React would warn about useLayoutEffect).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  // The "money" word — the shared element that flies into the hero headline.
  const sharedWordRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [animationDone, setAnimationDone] = useState(false);
  const isVisible = !prefersReducedMotion && !animationDone;

  // Already played this session? Skip before paint — no navbar hide, no lock.
  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion) return;
    if (sessionStorage.getItem(SEEN_KEY)) setAnimationDone(true);
  }, [prefersReducedMotion]);

  useEffect(() => {
    // Skip the splash entirely for reduced-motion users — no scroll lock,
    // no multi-second animation holding the page hostage.
    if (prefersReducedMotion) return;
    // Skip on any return visit within the session (guards against effect
    // ordering so we never run the scroll-lock path once seen).
    if (sessionStorage.getItem(SEEN_KEY)) return;

    // Commit to playing exactly once: mark seen up front so an interrupted
    // splash (navigate away mid-animation) still won't replay on return.
    sessionStorage.setItem(SEEN_KEY, '1');

    // Hide navbar and lock scroll while cinematic is active. Lenis drives the
    // wheel on window, so body overflow alone doesn't hold the page — stop()
    // Lenis too, otherwise the user can scroll behind the splash and the
    // fade-out reveals a page already scrolled past the hero.
    document.body.classList.add('cinematic-active');
    document.body.style.overflow = 'hidden';
    getLenis()?.stop();

    const ctx = gsap.context(() => {
      // Restore scroll, resume Lenis, reveal the real headline word, unmount.
      const finish = () => {
        document.body.classList.remove('cinematic-active');
        document.body.style.overflow = '';
        const lenis = getLenis();
        lenis?.scrollTo(0, { immediate: true });
        lenis?.start();
        const hw = document.getElementById('hero-shared-money');
        if (hw) gsap.set(hw, { clearProps: 'opacity,visibility' });
        setAnimationDone(true);
      };

      // The shared-element exit: everything dissolves except "money", which
      // glides from the splash into its slot in the hero <h1> — so the splash
      // text literally becomes the page. Then we hand off to the real word.
      const playExit = () => {
        gsap.set(containerRef.current, { pointerEvents: 'none' });
        const flyWord = sharedWordRef.current;
        const heroWord = document.getElementById('hero-shared-money');

        // No target to fly into (hero not mounted / reduced-motion race) —
        // fall back to a plain dissolve so we never trap the page.
        if (!flyWord || !heroWord) {
          gsap.to(containerRef.current, {
            autoAlpha: 0, duration: 0.6, ease: 'expo.inOut', onComplete: finish,
          });
          return;
        }

        const from = flyWord.getBoundingClientRect();
        const to = heroWord.getBoundingClientRect();

        // Hide the real headline word until the flown one lands, so the two
        // "money"s never show at once. Prep the flyer for a top-left morph.
        gsap.set(heroWord, { autoAlpha: 0 });
        gsap.set(flyWord, {
          position: 'relative', zIndex: 130,
          transformOrigin: 'top left', willChange: 'transform',
        });

        const tl = gsap.timeline({ onComplete: finish });

        // Dissolve the background + all the non-shared text; page shows through.
        tl.to(
          ['.cine-bg', '.cinematic-grid', '.film-grain',
           '.cine-word:not(.cine-shared)', '.cine-line2',
           '.cinematic-highlight', '.scroll-cue'],
          { autoAlpha: 0, duration: 0.6, ease: 'power2.inOut' },
          0
        );

        // "money" flies to the headline slot (rect-to-rect, so it lands
        // pixel-accurate across breakpoints) and settles into the h1 color.
        tl.to(
          flyWord,
          {
            x: to.left - from.left,
            y: to.top - from.top,
            scale: to.width / from.width,
            color: '#1d1d1f',
            duration: 0.95,
            ease: 'expo.inOut',
          },
          0
        );

        // Crossfade the flyer out / real word in at arrival — identical box, so
        // the swap is invisible and any sub-pixel drift is covered.
        tl.to(flyWord, { autoAlpha: 0, duration: 0.25 }, 0.8);
        tl.to(heroWord, { autoAlpha: 1, duration: 0.25 }, 0.82);
      };

      // Words streak in from the left with motion-blur + skew — reads as speed,
      // not a generic fade. The emphasis word rises in as a lime highlighter
      // sweeps behind it left→right. Fast on purpose: speed is the product.
      gsap.set(".cine-word", { autoAlpha: 0, xPercent: -45, skewX: -12, filter: "blur(14px)" });
      gsap.set(".cine-line2", { autoAlpha: 0, y: 20 });
      gsap.set(".cinematic-highlight", { scaleX: 0, transformOrigin: "left center" });
      gsap.set(".scroll-cue", { autoAlpha: 0, y: 12 });

      gsap
        .timeline({
          delay: 0.25,
          // Hold the assembled tagline briefly, then fly "money" into the page.
          onComplete: () => gsap.delayedCall(0.9, playExit),
        })
        .to(".cine-word", {
          duration: 0.9,
          autoAlpha: 1,
          xPercent: 0,
          skewX: 0,
          filter: "blur(0px)",
          stagger: 0.09,
          ease: "expo.out",
        })
        .to(
          ".cine-line2",
          { duration: 0.7, autoAlpha: 1, y: 0, ease: "expo.out" },
          "-=0.45"
        )
        .to(
          ".cinematic-highlight",
          { duration: 0.7, scaleX: 1, ease: "power4.inOut" },
          "<"
        )
        .to(
          ".scroll-cue",
          { duration: 0.6, autoAlpha: 1, y: 0, ease: "power2.out" },
          "-=0.35"
        );
    }, containerRef);

    return () => {
      ctx.revert();
      document.body.classList.remove('cinematic-active');
      document.body.style.overflow = '';
      getLenis()?.start();
      // If we unmounted mid-flight, make sure the real headline word is back.
      const hw = document.getElementById('hero-shared-money');
      if (hw) gsap.set(hw, { clearProps: 'opacity,visibility' });
    };
  }, [prefersReducedMotion]);

  if (!isVisible) return null;

  const words1 = tagline1.split(" ");

  return (
    <div
      ref={containerRef}
      className={cn(
        "cinematic-canvas fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center font-sans antialiased overflow-hidden",
        className
      )}
      style={{ perspective: "1200px" }}
      {...props}
    >
      {/* Background lives on its own layer so the exit can dissolve it while
          the shared "money" word flies out on top, still fully opaque. */}
      <div className="cine-bg absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />
      {/* Subtle ink grid + film grain over the light canvas */}
      <div className="cinematic-grid absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />
      <div className="film-grain" aria-hidden="true" />

      {/* Decorative splash — the page's real h1 lives in HeroSection */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full px-6" aria-hidden="true">
        <p
          className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.02]"
          style={{ color: "var(--color-foreground)", letterSpacing: "-0.03em" }}
        >
          {words1.map((w, i) => {
            const spacing = i < words1.length - 1 && "mr-[0.28em]";
            // Split out the shared "money" token so it can fly on its own while
            // its neighbours (e.g. a trailing ".") dissolve with the rest.
            const m = w.match(/^(.*?)(money)(\W*)$/i);
            if (m && m[2]) {
              return (
                <span key={i} className={cn("inline-block", spacing)}>
                  {m[1] && <span className="cine-word gsap-reveal inline-block">{m[1]}</span>}
                  <span ref={sharedWordRef} className="cine-word cine-shared gsap-reveal inline-block">
                    {m[2]}
                  </span>
                  {m[3] && <span className="cine-word gsap-reveal inline-block">{m[3]}</span>}
                </span>
              );
            }
            return (
              <span
                key={i}
                className={cn("cine-word gsap-reveal inline-block", spacing)}
              >
                {w}
              </span>
            );
          })}
        </p>

        <span className="relative mt-1 inline-block px-[0.12em]">
          {/* Lime highlighter sweeps in behind the emphasis word */}
          <span
            className="cinematic-highlight absolute z-0"
            style={{ left: 0, right: 0, top: "0.16em", bottom: "0.1em" }}
            aria-hidden="true"
          />
          <span
            className="cine-line2 gsap-reveal relative z-10 block text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold leading-[1.02]"
            style={{ color: "#174717", letterSpacing: "-0.035em" }}
          >
            {tagline2}
          </span>
        </span>
      </div>

      <div className="scroll-cue absolute bottom-12 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
        <span className="scroll-cue-line block" aria-hidden="true" />
      </div>
    </div>
  );
}
