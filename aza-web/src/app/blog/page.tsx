import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Blog | Aza",
  description: "Insights on African fintech, product updates, and developer resources from the Aza team.",
  alternates: { canonical: "/blog" },
};

const POSTS = [
  {
    slug: "super-app",
    date: "Jun 12, 2026",
    readTime: "5 min",
    tag: "Vision",
    title: "Why Africa's next super app won't come from Silicon Valley",
    excerpt:
      "The infrastructure gaps that stymied fintech in mature markets are the same ones that create the white space for a truly native African platform. Here's why the next WeChat or Alipay will be built here.",
    author: { name: "Aza Team", role: "Product" },
  },
  {
    slug: "zero-fee",
    date: "Jun 5, 2026",
    readTime: "4 min",
    tag: "Product",
    title: "Zero-fee transfers: the math behind Aza's model",
    excerpt:
      "Free to the user doesn't mean free to run. Here's how we make the economics work without charging for peer-to-peer transfers — and why we think it's the only sustainable path.",
    author: { name: "Aza Team", role: "Finance" },
  },
  {
    slug: "developer",
    date: "May 28, 2026",
    readTime: "6 min",
    tag: "Developers",
    title: "Build on Aza: the developer platform is now open",
    excerpt:
      "Mini apps, payment links, webhooks, and a REST API built for Africa. Everything you need to ship your first integration in an afternoon, with real test credentials from day one.",
    author: { name: "Aza Team", role: "Engineering" },
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen" style={{ background: "#ffffff", color: "#1d1d1f" }}>
      <Navbar />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-[100px] pb-12">
        <p className="text-[0.75rem] font-bold tracking-[0.15em] uppercase mb-4" style={{ color: "#174717" }}>
          From the team
        </p>
        <h1
          className="font-black leading-tight mb-3"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em" }}
        >
          The Aza Blog.
        </h1>
        <p className="text-[0.95rem]" style={{ color: "#6e6e73" }}>
          Fintech, product thinking, and what we&apos;re building — and why.
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div style={{ height: "1px", background: "rgba(0,0,0,0.07)" }} />
      </div>

      {/* Post list */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col gap-0">
          {POSTS.map((post, i) => (
            <article key={post.slug}>
              {i > 0 && <div style={{ height: "1px", background: "rgba(0,0,0,0.07)" }} />}
              <div className="py-10 grid gap-6 blog-post-grid">
                {/* Meta */}
                <div className="flex flex-col gap-2">
                  <span
                    className="text-[0.68rem] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded-lg self-start"
                    style={{ background: "rgba(23,71,23,0.08)", color: "#174717" }}
                  >
                    {post.tag}
                  </span>
                  <p className="text-[0.75rem]" style={{ color: "#6e6e73" }}>{post.date} · {post.readTime} read</p>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-3">
                  <Link href={`/blog/${post.slug}`}>
                    <h2
                      className="font-bold leading-snug transition-opacity hover:opacity-70"
                      style={{ fontSize: "1.25rem", letterSpacing: "-0.03em" }}
                    >
                      {post.title}
                    </h2>
                  </Link>
                  <p className="text-[0.9rem] leading-[1.7]" style={{ color: "#6e6e73", maxWidth: "600px" }}>
                    {post.excerpt}
                  </p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="self-start mt-1 text-[0.82rem] font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-60"
                    style={{ color: "#174717" }}
                  >
                    Read article
                    <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Newsletter / CTA */}
      <section style={{ background: "#f5f5f7" }}>
        <div className="max-w-5xl mx-auto px-6 py-14 text-center">
          <h2 className="font-black mb-3" style={{ fontSize: "1.6rem", letterSpacing: "-0.035em" }}>
            Want these in your inbox?
          </h2>
          <p className="text-[0.9rem] mb-6 max-w-[380px] mx-auto" style={{ color: "#6e6e73" }}>
            Join the waitlist and you&apos;ll be first to get new posts, product updates, and early access.
          </p>
          <Link
            href="/#waitlist"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[0.875rem] font-semibold transition-opacity hover:opacity-85"
            style={{ background: "#174717", color: "#B7EE7A" }}
          >
            Join the waitlist
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[0.75rem]" style={{ color: "#6e6e73" }}>
            &copy; {new Date().getFullYear()} Aza Systems Ltd. Made in Ghana.
          </p>
          <div className="flex gap-5 text-[0.75rem]" style={{ color: "#6e6e73" }}>
            <Link href="/privacy-policy" className="hover:opacity-70 transition-opacity">Privacy</Link>
            <Link href="/terms-of-service" className="hover:opacity-70 transition-opacity">Terms</Link>
            <Link href="/about" className="hover:opacity-70 transition-opacity">About</Link>
          </div>
        </div>
      </footer>

      <style>{`
        .blog-post-grid { grid-template-columns: 140px 1fr; }
        @media (max-width: 600px) {
          .blog-post-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
