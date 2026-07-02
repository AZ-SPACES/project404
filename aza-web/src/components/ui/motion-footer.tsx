"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.546,12.763c0.024-1.87,1.004-3.597,2.597-4.576c-1.009-1.442-2.64-2.323-4.399-2.378    c-1.851-0.194-3.645,1.107-4.588,1.107c-0.961,0-2.413-1.088-3.977-1.056C6.122,5.927,4.25,7.068,3.249,8.867    c-2.131,3.69-0.542,9.114,1.5,12.097c1.022,1.461,2.215,3.092,3.778,3.035c1.529-0.063,2.1-0.975,3.945-0.975    c1.828,0,2.364,0.975,3.958,0.938c1.64-0.027,2.674-1.467,3.66-2.942c0.734-1.041,1.299-2.191,1.673-3.408    C19.815,16.788,18.548,14.879,18.546,12.763z" />
    <path d="M15.535,3.847C16.429,2.773,16.87,1.393,16.763,0c-1.366,0.144-2.629,0.797-3.535,1.829    c-0.895,1.019-1.349,2.351-1.261,3.705C13.352,5.548,14.667,4.926,15.535,3.847z" />
  </svg>
);

const GooglePlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.487 1.487 0 0 0-.227.82v21.89c0 .28.077.54.211.76l11.498-11.54L1.337.924zm10.992 10.927L1.297 22.872a1.498 1.498 0 0 0 1.58-.315l13.06-7.398-4.608-3.308zm.214-.215l4.655 3.339 3.028-1.715L2.946.6a1.5 1.5 0 0 0-.803-.303l10.4 11.339z" />
  </svg>
);

// Register ScrollTrigger safely for React
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// -------------------------------------------------------------------------
// 1. THEME-ADAPTIVE INLINE STYLES (Uncodixified)
// -------------------------------------------------------------------------
const STYLES = `
.cinematic-footer-wrapper {
  /* Using straightforward variables avoiding complex color-mixed glass logic */
  --pill-bg: #111827;
  --pill-text: #ffffff;
  --pill-border: #1f2937;
  --pill-bg-hover: #1f2937;
}

[data-theme="light"] .cinematic-footer-wrapper {
  --pill-bg: #f3f4f6;
  --pill-text: #111827;
  --pill-border: #e5e7eb;
  --pill-bg-hover: #e5e7eb;
}

@keyframes footer-scroll-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes footer-heartbeat {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(239,68,68,0.5)); }
  15%, 45% { transform: scale(1.2); filter: drop-shadow(0 0 10px rgba(239,68,68,0.8)); }
  30% { transform: scale(1); }
}

.animate-footer-scroll-marquee {
  animation: footer-scroll-marquee 40s linear infinite;
}

.animate-footer-heartbeat {
  animation: footer-heartbeat 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

/* Theme-adaptive Grid Background - Simplified Uncodixified version */
.footer-bg-grid {
  background-size: 60px 60px;
  background-image: 
    linear-gradient(to right, rgba(150, 150, 150, 0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(150, 150, 150, 0.1) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}

/* Solid Pill Theming - Replaced glassmorphism with clean, flat styles */
.footer-solid-pill {
  background: var(--pill-bg);
  border: 1px solid var(--pill-border);
  color: var(--pill-text);
  transition: background-color 0.2s ease, color 0.2s ease;
}

@media (hover: hover) and (pointer: fine) {
  .footer-solid-pill:hover {
    background: var(--pill-bg-hover);
  }
}

/* Giant Background Text Masking */
.footer-giant-bg-text {
  font-size: 26vw;
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(150, 150, 150, 0.1);
  background: linear-gradient(180deg, rgba(150, 150, 150, 0.2) 0%, transparent 60%);
  -webkit-background-clip: text;
  background-clip: text;
}
`;

// -------------------------------------------------------------------------
// 2. MAGNETIC BUTTON PRIMITIVE
// -------------------------------------------------------------------------
export type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & 
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: React.ElementType;
  };

const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = "button", ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement>(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const element = localRef.current;
      if (!element) return;

      const ctx = gsap.context(() => {
        const handleMouseMove = (e: MouseEvent) => {
          const rect = element.getBoundingClientRect();
          const h = rect.width / 2;
          const w = rect.height / 2;
          const x = e.clientX - rect.left - h;
          const y = e.clientY - rect.top - w;

          gsap.to(element, {
            x: x * 0.4,
            y: y * 0.4,
            rotationX: -y * 0.15,
            rotationY: x * 0.15,
            scale: 1.05,
            ease: "power2.out",
            duration: 0.4,
          });
        };

        const handleMouseLeave = () => {
          gsap.to(element, {
            x: 0,
            y: 0,
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            ease: "elastic.out(1, 0.3)",
            duration: 1.2,
          });
        };

        element.addEventListener("mousemove", handleMouseMove as EventListener);
        element.addEventListener("mouseleave", handleMouseLeave);

        return () => {
          element.removeEventListener("mousemove", handleMouseMove as EventListener);
          element.removeEventListener("mouseleave", handleMouseLeave);
        };
      }, element);

      return () => ctx.revert();
    },[]);

    return (
      <Component
        ref={(node: HTMLElement | null) => {
          (localRef as React.MutableRefObject<HTMLElement | null>).current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
MagneticButton.displayName = "MagneticButton";

// -------------------------------------------------------------------------
// 3. MAIN COMPONENT
// -------------------------------------------------------------------------
const MarqueeItem = () => (
  <div className="flex items-center space-x-12 px-6">
    <span>Send Effortlessly</span> <span className="opacity-40">✦</span>
    <span>Zero Hidden Fees</span> <span className="opacity-40">✦</span>
    <span>Built for Africa</span> <span className="opacity-40">✦</span>
    <span>Bank-grade Security</span> <span className="opacity-40">✦</span>
    <span>Instant Transfers</span> <span className="opacity-40">✦</span>
  </div>
);

export function CinematicFooter() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Reduced motion: skip parallax/reveal — elements stay at their natural,
    // fully visible state since gsap.fromTo never runs.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!wrapperRef.current) return;

    const ctx = gsap.context(() => {
      // Background Parallax
      gsap.fromTo(
        giantTextRef.current,
        { y: "10vh", scale: 0.8, opacity: 0 },
        {
          y: "0vh",
          scale: 1,
          opacity: 1,
          ease: "power1.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 80%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );

      // Hide Navbar when footer comes into view
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: "top 70%",
        onEnter: () => gsap.to("#navbar", { yPercent: -150, autoAlpha: 0, duration: 0.4, ease: "power2.inOut" }),
        onLeaveBack: () => gsap.to("#navbar", { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" }),
      });

      // Staggered Content Reveal
      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 40%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );
    }, wrapperRef);

    return () => ctx.revert();
  },[]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      
      {/* 
        The "Curtain Reveal" Wrapper:
        It sits in standard flow. Because it has clip-path, its contents
        are ONLY visible within its bounding box. 
      */}
      <div
        ref={wrapperRef}
        className="relative h-screen w-full"
        style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
      >
        {/* The actual footer stays fixed to the viewport underneath everything */}
        <footer className="fixed bottom-0 left-0 flex h-screen w-full flex-col justify-between overflow-hidden bg-background text-foreground cinematic-footer-wrapper">
          
          <div className="footer-bg-grid absolute inset-0 z-0 pointer-events-none" />

          {/* Giant background text */}
          <div
            ref={giantTextRef}
            className="footer-giant-bg-text absolute -bottom-[5vh] left-1/2 -translate-x-1/2 whitespace-nowrap z-0 pointer-events-none select-none"
          >
            AZA
          </div>

          {/* 1. Diagonal Sleek Marquee (Top of footer) */}
          <div className="absolute top-12 left-0 w-full overflow-hidden border-y border-border/50 bg-background/90 py-4 z-10 -rotate-2 scale-110">
            <div className="flex w-max animate-footer-scroll-marquee text-xs md:text-sm font-bold tracking-[0.3em] text-muted-foreground uppercase">
              <MarqueeItem />
              <MarqueeItem />
            </div>
          </div>

          {/* 2. Main Center Content */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 mt-20 w-full max-w-5xl mx-auto">
            <h2
              ref={headingRef}
              className="text-5xl md:text-8xl font-black tracking-tighter mb-12 text-center"
            >
              Ready to begin?
            </h2>

            {/* Interactive Magnetic Pills Layout */}
            <div ref={linksRef} className="flex flex-col items-center gap-6 w-full">
              {/* App Store Links (Primary) */}
              <div className="flex flex-wrap justify-center gap-4 w-full">
                <MagneticButton as="a" href="/#waitlist" className="footer-solid-pill px-10 py-4 rounded-xl font-bold text-sm md:text-base flex items-center gap-3 group">
                  <AppleIcon className="w-5 h-5 text-current" />
                  Download on the App Store
                </MagneticButton>

                <MagneticButton as="a" href="/#waitlist" className="footer-solid-pill px-10 py-4 rounded-xl font-bold text-sm md:text-base flex items-center gap-3 group">
                  <GooglePlayIcon className="w-5 h-5 text-current" />
                  Get it on Google Play
                </MagneticButton>
              </div>

              {/* Secondary Text Links */}
              <div className="flex flex-wrap justify-center gap-3 md:gap-6 w-full mt-2">
                <MagneticButton as="a" href="/about" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  About
                </MagneticButton>
                <MagneticButton as="a" href="/blog" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Blog
                </MagneticButton>
                <MagneticButton as="a" href="/agents" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Agents
                </MagneticButton>
                <MagneticButton as="a" href="/mini-apps" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Mini Apps
                </MagneticButton>
                <MagneticButton as="a" href="/developers" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Developers
                </MagneticButton>
                <MagneticButton as="a" href="/security" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Security
                </MagneticButton>
                <MagneticButton as="a" href="/compliance" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Compliance
                </MagneticButton>
                <MagneticButton as="a" href="/privacy-policy" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Privacy Policy
                </MagneticButton>
                <MagneticButton as="a" href="/terms-of-service" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Terms of Service
                </MagneticButton>
                <MagneticButton as="a" href="/cookie-policy" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Cookie Policy
                </MagneticButton>
                <MagneticButton as="a" href="/delete-account" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Delete Account
                </MagneticButton>
                <MagneticButton as="a" href="mailto:support@aza.systems" className="footer-solid-pill px-6 py-2 rounded-xl font-medium text-xs md:text-sm">
                  Contact Support
                </MagneticButton>
              </div>

              {/* Social Links */}
              <div className="flex items-center justify-center gap-3 mt-1">
                <MagneticButton
                  as="a"
                  href="https://x.com/azafintech"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Follow Aza on X"
                  className="footer-solid-pill w-10 h-10 rounded-xl flex items-center justify-center"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.263 5.633 5.901-5.633Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </MagneticButton>

                <MagneticButton
                  as="a"
                  href="https://instagram.com/azafintech"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Follow Aza on Instagram"
                  className="footer-solid-pill w-10 h-10 rounded-xl flex items-center justify-center"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
                  </svg>
                </MagneticButton>

                <MagneticButton
                  as="a"
                  href="https://linkedin.com/company/azafintech"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Follow Aza on LinkedIn"
                  className="footer-solid-pill w-10 h-10 rounded-xl flex items-center justify-center"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </MagneticButton>
              </div>
            </div>
          </div>

          {/* 3. Bottom Bar / Credits */}
          <div className="relative z-20 w-full pb-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Copyright */}
            <div className="text-muted-foreground text-[10px] md:text-xs font-semibold tracking-widest uppercase order-2 md:order-1">
              © {new Date().getFullYear()} JumpSpaces, Inc. All rights reserved.
            </div>

            <div className="text-muted-foreground text-[10px] md:text-xs font-semibold tracking-widest uppercase order-1 md:order-2">
              Soon available worldwide
            </div>


            {/* Back to top */}
            <MagneticButton
              as="button"
              onClick={scrollToTop}
              className="w-12 h-12 rounded-full footer-solid-pill flex items-center justify-center group order-3"
            >
              <ChevronUp className="w-5 h-5 transform group-hover:-translate-y-1 transition-transform duration-200 text-current" />
            </MagneticButton>

          </div>
        </footer>
      </div>
    </>
  );
}
