"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SlideMeta } from "@/lib/deck";
import { ThemeToggle } from "@/components/deck/ThemeToggle";
import { cn } from "@/lib/utils";

const PREV_KEYS = new Set(["ArrowUp", "ArrowLeft", "PageUp"]);
const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight", "PageDown", " "]);

/**
 * The deck shell for one track: owns scrolling, the active-slide index, keyboard
 * navigation and the chrome. Slides stay server components — they arrive as
 * `children` and this file never inspects them, it reads `[data-slide]` off the
 * DOM and matches by position against `slides`.
 *
 * Mounted with a `key` of the track id, so switching tracks remounts rather than
 * trying to reconcile two different running orders.
 */
export function Deck({
  slides,
  trackName,
  onExit,
  children,
}: {
  slides: SlideMeta[];
  trackName: string;
  onExit: () => void;
  children: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [hasNavigated, setHasNavigated] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, index));
      const el = scrollerRef.current?.querySelectorAll<HTMLElement>("[data-slide]")[clamped];
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      /* Focus first, scroll second. A rail click leaves focus on the button and it
         has to come back so the next arrow key reaches the deck — but calling
         focus() *after* scrollIntoView aborts the smooth scroll it just started,
         which strands the deck on the slide it was leaving. */
      scrollerRef.current?.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      setHasNavigated(true);
    },
    [slides.length],
  );

  /* Active-slide tracking. The observer is the only writer of `active`, so
     scrolling, keyboard jumps and rail clicks all converge on one code path
     instead of three that can disagree. */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nodes = Array.from(scroller.querySelectorAll<HTMLElement>("[data-slide]"));

    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        }
        if (!best || best.intersectionRatio < 0.35) return;
        const index = nodes.indexOf(best.target as HTMLElement);
        if (index >= 0) setActive(index);

        /* `is-live` is added and never removed. Replaying a 600ms stagger every
           time the presenter scrolls back to re-explain a slide reads as a
           glitch, not as polish. */
        best.target.classList.add("is-live");
      },
      { root: scroller, threshold: [0.35, 0.6, 0.9] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* The scroller owns keyboard navigation, so it has to actually hold focus.
     Without this the arrow keys depend on wherever focus happened to land — which
     is the document body on a cold load, but the theme toggle or a rail dot after
     any click, and nothing at all if the page is reached from browser chrome.
     `preventScroll` matters: focusing a snap container otherwise nudges it. */
  useEffect(() => {
    scrollerRef.current?.focus({ preventScroll: true });
  }, []);

  /* Deep links: `/#unit-economics` opens on that slide. Done without setState so
     the observer above stays the single writer of `active`. */
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const index = slides.findIndex((s) => s.id === hash);
    if (index <= 0) return;
    scrollerRef.current
      ?.querySelectorAll<HTMLElement>("[data-slide]")
      [index]?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [slides]);

  /* Keep the address bar in step, but with replaceState — pushState here would
     make the browser Back button walk the deck backwards one slide at a time. */
  useEffect(() => {
    const id = slides[active]?.id;
    if (!id) return;
    const url = new URL(window.location.href);
    url.hash = active === 0 ? "" : id;
    window.history.replaceState(null, "", url.toString());
  }, [active, slides]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;

      if (NEXT_KEYS.has(event.key)) {
        event.preventDefault();
        goTo(active + 1);
      } else if (PREV_KEYS.has(event.key)) {
        event.preventDefault();
        goTo(active - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(slides.length - 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, goTo, onExit, slides.length]);

  const meta = slides[active];
  const progress = slides.length > 1 ? active / (slides.length - 1) : 0;

  return (
    <>
      <header className="deck-chrome deck-chrome--top">
        <div className="deck-brand">
          <span className="deck-wordmark">AZA</span>
          <span className="deck-brand-sep" aria-hidden="true" />
          <button
            type="button"
            className="deck-track"
            onClick={onExit}
            title="Change track — Esc"
          >
            {trackName}
            <span aria-hidden="true">&#8645;</span>
          </button>
        </div>

        <div className="deck-counter mono">
          <ThemeToggle />
          {meta?.ref ? <span className="deck-ref">{meta.ref}</span> : null}
          <span>
            {String(active + 1).padStart(2, "0")}
            <span className="dim"> / {String(slides.length).padStart(2, "0")}</span>
          </span>
        </div>
      </header>

      <nav className="deck-rail" aria-label="Slides">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            className={cn("deck-dot", i === active && "is-active")}
            aria-current={i === active ? "true" : undefined}
            aria-label={`Slide ${i + 1}: ${slide.label}`}
            onClick={() => goTo(i)}
          >
            <span className="deck-dot-mark" aria-hidden="true" />
            <span className="deck-dot-label" aria-hidden="true">
              {slide.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="deck-progress" aria-hidden="true">
        <div className="deck-progress-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Slide {active + 1} of {slides.length}: {meta?.label}
      </p>

      <div
        className={cn("deck-hint", (hasNavigated || active > 0) && "is-gone")}
        aria-hidden="true"
      >
        <span className="mono">Scroll</span>
        <span className="deck-hint-sep">or</span>
        <kbd>&larr;</kbd>
        <kbd>&rarr;</kbd>
      </div>

      <div
        className="deck"
        ref={scrollerRef}
        tabIndex={-1}
        role="region"
        aria-label={`${trackName} deck`}
      >
        {children}
      </div>
    </>
  );
}
