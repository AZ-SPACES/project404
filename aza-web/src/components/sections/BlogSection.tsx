"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const POSTS = [
  {
    id: "super-app",
    date: "Jun 12, 2026",
    readTime: "5 min",
    tag: "Vision",
    title: "Why Africa's next super app won't come from Silicon Valley",
    excerpt:
      "The infrastructure gaps that stymied fintech in mature markets are the same ones that create the white space for a truly native African platform.",
  },
  {
    id: "zero-fee",
    date: "Jun 5, 2026",
    readTime: "4 min",
    tag: "Product",
    title: "Zero-fee transfers: the math behind Aza's model",
    excerpt:
      "Free to the user doesn't mean free to run. Here's how we make the economics work — and why we think it's the only sustainable path.",
  },
  {
    id: "developer",
    date: "May 28, 2026",
    readTime: "6 min",
    tag: "Developers",
    title: "Build on Aza: the developer platform is now open",
    excerpt:
      "Mini apps, payment links, webhooks, and a REST API built for Africa. Everything you need to ship your first integration in an afternoon.",
  },
];

export function BlogSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current?.querySelectorAll<HTMLElement>(".blog-card");
    if (!cards) return;
    gsap.fromTo(
      cards,
      { y: 32, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.75,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, []);

  return (
    <section id="blog" className="apple-light section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        <div className="flex items-end justify-between mb-10 reveal">
          <h2 className="apple-headline" style={{ color: "#1d1d1f" }}>
            From the team.
          </h2>
          <a
            href="/blog"
            className="hidden sm:inline-flex items-center gap-1.5 text-[0.875rem] font-semibold transition-opacity hover:opacity-70"
            style={{ color: "#174717" }}
          >
            All posts
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div ref={gridRef} className="blog-grid grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {POSTS.map((p) => (
            <article
              key={p.id}
              className="blog-card rounded-2xl p-6 flex flex-col gap-4 group cursor-pointer"
              style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[0.68rem] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded-lg"
                  style={{ background: "rgba(23,71,23,0.08)", color: "#174717" }}
                >
                  {p.tag}
                </span>
                <span className="text-[0.72rem]" style={{ color: "#6e6e73" }}>
                  {p.readTime} read
                </span>
              </div>

              <div className="flex-1">
                <h3
                  className="font-bold leading-snug mb-2 transition-colors group-hover:opacity-70"
                  style={{ fontSize: "1rem", color: "#1d1d1f", letterSpacing: "-0.02em" }}
                >
                  {p.title}
                </h3>
                <p className="text-[0.83rem] leading-[1.65]" style={{ color: "#6e6e73" }}>
                  {p.excerpt}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <span className="text-[0.75rem]" style={{ color: "#6e6e73" }}>
                  {p.date}
                </span>
                <span
                  className="text-[0.8rem] font-semibold flex items-center gap-1 transition-opacity group-hover:opacity-60"
                  style={{ color: "#174717" }}
                >
                  Read
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .blog-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 801px) and (max-width: 1020px) {
          .blog-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .blog-card { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
}
