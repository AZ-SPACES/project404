"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type RevealKind = "y" | "x-left" | "x-right" | "scale";

function fromVars(kind: RevealKind) {
  switch (kind) {
    case "y":       return { y: 28,  opacity: 0 };
    case "x-left":  return { x: -30, opacity: 0 };
    case "x-right": return { x: 30,  opacity: 0 };
    case "scale":   return { scale: 0.92, y: 14, opacity: 0 };
  }
}

function toVars(kind: RevealKind, delay: number) {
  const shared = {
    opacity: 1,
    duration: kind === "scale" ? 0.88 : 0.78,
    delay,
    ease: "power3.out",
  };
  switch (kind) {
    case "y":       return { ...shared, y: 0 };
    case "x-left":  return { ...shared, x: 0 };
    case "x-right": return { ...shared, x: 0 };
    case "scale":   return { ...shared, scale: 1, y: 0 };
  }
}

const MAP: [string, RevealKind][] = [
  [".reveal",         "y"],
  [".reveal-x-left",  "x-left"],
  [".reveal-x-right", "x-right"],
  [".reveal-scale",   "scale"],
];

export function ScrollReveal() {
  useEffect(() => {
    const all = document.querySelectorAll<HTMLElement>(
      ".reveal, .reveal-x-left, .reveal-x-right, .reveal-scale"
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      all.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const ctx = gsap.context(() => {
      MAP.forEach(([selector, kind]) => {
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          const delay = el.dataset.delay ? parseInt(el.dataset.delay, 10) / 1000 : 0;
          gsap.fromTo(el, fromVars(kind), {
            ...toVars(kind, delay),
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          });
        });
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
