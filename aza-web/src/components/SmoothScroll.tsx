"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setLenis } from "@/lib/smooth-scroll-instance";

gsap.registerPlugin(ScrollTrigger);

// Sync Lenis' virtual scroll position with GSAP ScrollTrigger so that
// scroll-driven animations track the smooth scroll position, not the raw
// DOM scroll offset.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.25,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    lenis.on("scroll", ScrollTrigger.update);
    setLenis(lenis);

    function onRaf(time: number) {
      lenis.raf(time * 1000);
    }

    gsap.ticker.add(onRaf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onRaf);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  return null;
}
