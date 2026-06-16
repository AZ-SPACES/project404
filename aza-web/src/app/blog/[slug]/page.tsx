import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ArrowLeft } from "lucide-react";

const POSTS: Record<string, {
  slug: string;
  date: string;
  readTime: string;
  tag: string;
  title: string;
  excerpt: string;
  author: { name: string; role: string };
  body: React.ReactNode;
}> = {
  "super-app": {
    slug: "super-app",
    date: "Jun 12, 2026",
    readTime: "5 min",
    tag: "Vision",
    title: "Why Africa's next super app won't come from Silicon Valley",
    excerpt:
      "The infrastructure gaps that stymied fintech in mature markets are the same ones that create the white space for a truly native African platform.",
    author: { name: "Aza Team", role: "Product" },
    body: (
      <>
        <p>
          When WeChat added payments in 2013, the timing wasn&apos;t accidental. China&apos;s banking infrastructure
          was underdeveloped relative to its mobile penetration, and WeChat stepped into that gap. The same dynamic
          is playing out in Africa today — at a much larger scale, and much faster.
        </p>
        <h2>The infrastructure gap is the opportunity</h2>
        <p>
          In Ghana, Nigeria, and Kenya, more people have smartphones than bank accounts. Mobile money — pioneered
          by M-Pesa in 2007 — showed the world that leapfrogging traditional banking infrastructure was possible.
          But mobile money stopped short of becoming a platform. It solved payments, not everything built on top
          of payments.
        </p>
        <p>
          That&apos;s the gap Aza is built to fill. Not just transfers, but the entire financial life of a person:
          chat with friends, split a bill, pay a merchant, access a loan, play a game — all from one app that
          already knows who you are and holds your money.
        </p>
        <h2>Why Silicon Valley can&apos;t build this</h2>
        <p>
          A company in San Francisco will build for San Francisco problems first, then try to &quot;expand&quot; to
          Africa. That means designing for credit cards, then bolting on mobile money. Designing for 100ms latency,
          then struggling with intermittent connectivity. Building compliance for SEC regulations, then trying to
          figure out the Bank of Ghana.
        </p>
        <p>
          The companies that will win in Africa will be the ones who treated Ghana as a primary market, not a
          secondary one. Who built their KYC pipeline around the Ghana Card from day one. Who made offline-resilient
          transfers the default, not an edge case.
        </p>
        <h2>What we&apos;re building</h2>
        <p>
          Aza starts in Ghana with P2P transfers, chat, QR payments, and a mini-app platform. Each of these
          individually is not new. Together, integrated natively, they create something that doesn&apos;t exist yet:
          a super app built from the ground up for the African context — not retrofitted to it.
        </p>
        <p>
          We&apos;re not trying to be the African version of something. We&apos;re building what Africa needs next.
        </p>
      </>
    ),
  },
  "zero-fee": {
    slug: "zero-fee",
    date: "Jun 5, 2026",
    readTime: "4 min",
    tag: "Product",
    title: "Zero-fee transfers: the math behind Aza's model",
    excerpt:
      "Free to the user doesn't mean free to run. Here's how we make the economics work — and why we think it's the only sustainable path.",
    author: { name: "Aza Team", role: "Finance" },
    body: (
      <>
        <p>
          The most common question we get from investors and users alike: &quot;How do you make money if transfers
          are free?&quot; It&apos;s a fair question. Mobile money charges 0.5–2% per transfer. Banks charge flat fees
          plus percentages. We charge nothing for P2P. So what&apos;s the model?
        </p>
        <h2>Revenue doesn&apos;t come from P2P</h2>
        <p>
          P2P transfer fees are the worst possible revenue model for a payments app trying to grow. Every fee is
          a reason not to send money. Every ₵1 charged is a reason to use a competitor. Free P2P is a growth
          strategy disguised as a loss leader — except it&apos;s not really a loss.
        </p>
        <p>
          Our revenue comes from three places: merchant processing fees (businesses pay, not individuals), float
          income on funds held in the wallet, and platform fees from third-party mini-apps in the Hub. None of
          these touch the P2P transfer experience.
        </p>
        <h2>The float model</h2>
        <p>
          When you hold a balance in Aza, that money sits in a regulated, segregated bank account. The interest
          on that float is Aza&apos;s. At scale, with hundreds of thousands of users holding average balances of even
          ₵50, this compounds into meaningful revenue without charging a single person a single cedi for a transfer.
        </p>
        <h2>Merchant economics</h2>
        <p>
          Merchants pay 0.8% per transaction for QR and payment link payments — below the 1.5–2.5% typical for
          card networks, competitive with mobile money, and far simpler to reconcile. We make money when commerce
          happens. That aligns our incentives with our users: the more Aza is used, the more everyone benefits.
        </p>
        <h2>Why this is the only sustainable path</h2>
        <p>
          If you charge for P2P, you have a payments utility. If you make P2P free and build a platform on top of
          it, you have a super app. Utilities compete on price. Platforms compete on ecosystem. We&apos;re not
          building a utility.
        </p>
      </>
    ),
  },
  "developer": {
    slug: "developer",
    date: "May 28, 2026",
    readTime: "6 min",
    tag: "Developers",
    title: "Build on Aza: the developer platform is now open",
    excerpt:
      "Mini apps, payment links, webhooks, and a REST API built for Africa. Everything you need to ship your first integration in an afternoon.",
    author: { name: "Aza Team", role: "Engineering" },
    body: (
      <>
        <p>
          Today we&apos;re opening the Aza Developer Platform to all registered developers. That means live API keys,
          a full sandbox environment, OAuth 2.0 for &quot;Sign in with Aza&quot;, payment links, webhooks, and the
          mini-app SDK — all available now.
        </p>
        <h2>What you can build</h2>
        <p>
          The platform has three main integration surfaces. Each solves a different problem.
        </p>
        <p>
          <strong>Payment Links</strong> — generate a link or QR code that lets any Aza user pay you instantly.
          No redirect. No card entry. No waiting. Works in WhatsApp, SMS, email, or embedded in a website.
        </p>
        <p>
          <strong>REST API + Webhooks</strong> — full programmatic access to payments, payouts, and transaction
          history. Webhooks fire in real time on payment events. Idempotency keys are supported natively — no
          worrying about duplicate charges on retry.
        </p>
        <p>
          <strong>Mini Apps</strong> — ship a web app that runs natively inside Aza. Your app gets access to the
          user&apos;s Aza identity and can initiate payments with a single SDK call. No separate authentication flow,
          no separate wallet integration. The user is already there.
        </p>
        <h2>The sandbox actually works</h2>
        <p>
          This sounds obvious, but it&apos;s rarer than it should be: our sandbox is a complete mirror of production.
          It has test users, test wallets, real webhook delivery, and a dashboard that shows you exactly what&apos;s
          happening. You can simulate payment failures, test idempotency, and verify webhook signatures — all
          without touching real money.
        </p>
        <h2>Getting started</h2>
        <p>
          Register at the Developer Portal, generate your API keys, and make your first API call. The quickstart
          guide gets you from zero to a working payment link in under 10 minutes. We&apos;ve also published SDKs
          for JavaScript and Python, with more coming.
        </p>
        <p>
          If you have questions, join the developer community on Discord or reach us at developers@aza.systems.
          We respond to every message.
        </p>
      </>
    ),
  },
};

export async function generateStaticParams() {
  return Object.keys(POSTS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) notFound();

  return (
    <div className="min-h-screen" style={{ background: "#ffffff", color: "#1d1d1f" }}>
      <Navbar />

      <article className="max-w-[680px] mx-auto px-6 pt-[100px] pb-20">
        {/* Back */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold mb-10 transition-opacity hover:opacity-60"
          style={{ color: "#174717" }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          All posts
        </Link>

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-[0.68rem] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded-lg"
              style={{ background: "rgba(23,71,23,0.08)", color: "#174717" }}
            >
              {post.tag}
            </span>
            <span className="text-[0.75rem]" style={{ color: "#6e6e73" }}>
              {post.date} · {post.readTime} read
            </span>
          </div>
          <h1
            className="font-black leading-tight mb-4"
            style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", letterSpacing: "-0.04em" }}
          >
            {post.title}
          </h1>
          <p className="text-[1rem] leading-[1.7]" style={{ color: "#6e6e73" }}>
            {post.excerpt}
          </p>
        </header>

        <div style={{ height: "1px", background: "rgba(0,0,0,0.07)", marginBottom: "2.5rem" }} />

        {/* Body */}
        <div className="blog-body">{post.body}</div>

        <div style={{ height: "1px", background: "rgba(0,0,0,0.07)", margin: "3rem 0" }} />

        {/* Footer CTA */}
        <div className="text-center">
          <p className="font-semibold mb-4" style={{ color: "#1d1d1f", fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
            Want early access to Aza?
          </p>
          <Link
            href="/#waitlist"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[0.875rem] font-semibold transition-opacity hover:opacity-85"
            style={{ background: "#174717", color: "#B7EE7A" }}
          >
            Join the waitlist
          </Link>
        </div>
      </article>

      <footer className="border-t py-8" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
        <div className="max-w-[680px] mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[0.75rem]" style={{ color: "#6e6e73" }}>
            &copy; {new Date().getFullYear()} Aza Systems Ltd. Made in Ghana.
          </p>
          <div className="flex gap-5 text-[0.75rem]" style={{ color: "#6e6e73" }}>
            <Link href="/blog" className="hover:opacity-70 transition-opacity">Blog</Link>
            <Link href="/privacy-policy" className="hover:opacity-70 transition-opacity">Privacy</Link>
            <Link href="/terms-of-service" className="hover:opacity-70 transition-opacity">Terms</Link>
          </div>
        </div>
      </footer>

      <style>{`
        .blog-body p { margin-bottom: 1.5rem; font-size: 1rem; line-height: 1.8; color: #3d3d3f; }
        .blog-body h2 { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.03em; color: #1d1d1f; margin: 2.5rem 0 1rem; }
        .blog-body strong { color: #1d1d1f; font-weight: 700; }
      `}</style>
    </div>
  );
}
