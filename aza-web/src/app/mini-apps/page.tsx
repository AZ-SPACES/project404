import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Mini Apps | Aza",
  description: "An app store inside your wallet. No installs, no new accounts — Aza Mini Apps run instantly inside the Aza app, and anyone can build one.",
  alternates: { canonical: "/mini-apps" },
};

const APPS = [
  { name: "Aza Business", desc: "Accept payments, manage payouts and API keys.", icon: "/hub-apps/aza-business.png", category: "Business" },
  { name: "Aza Agent", desc: "Cash-in and cash-out dashboard for agents.", icon: "/hub-apps/aza-developer.png", category: "Business" },
  { name: "CediRates", desc: "Live exchange rates and fuel prices.", icon: "/hub-apps/cedirates.png", category: "Finance" },
  { name: "2048", desc: "Join the numbers and get to 2048!", icon: "/hub-apps/2048.png", category: "Games" },
  { name: "Snake", desc: "Eat apples, grow your snake.", icon: "/hub-apps/snakegame.png", category: "Games" },
  { name: "Connect 4", desc: "Connect 4 in a row to win.", icon: "/hub-apps/connect4.png", category: "Games" },
  { name: "Radio", desc: "Listen to live radio stations.", icon: "/hub-apps/radio.png", category: "Entertainment" },
  { name: "Notepad", desc: "Take notes quickly inside Aza.", icon: "/hub-apps/notepad.png", category: "Productivity" },
];

const PRINCIPLES = [
  {
    num: "01",
    title: "No installs.",
    body: "Mini apps open instantly inside Aza. There's nothing to download from a store and nothing left behind when you close it.",
  },
  {
    num: "02",
    title: "No new accounts.",
    body: "Your Aza identity carries over. Sign in once, and every mini app you open already knows it's you — with your explicit consent.",
  },
  {
    num: "03",
    title: "You control what's shared.",
    body: "Each app declares exactly what it needs — your profile, wallet balance, the ability to request a payment — and you approve it per app, not all at once.",
  },
  {
    num: "04",
    title: "Reviewed before launch.",
    body: "Every submission is checked for security, permissions, and content before it goes live in the Hub.",
  },
];

export default function MiniAppsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#ffffff", color: "#1d1d1f" }}>
      <Navbar />

      <main>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-[100px] pb-16">
        <div className="max-w-[720px]">
          <p className="text-[0.75rem] font-bold tracking-[0.15em] uppercase mb-5" style={{ color: "#174717" }}>
            Mini Apps
          </p>
          <h1
            className="font-black leading-tight mb-6"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", letterSpacing: "-0.04em", textWrap: "balance" }}
          >
            An app store,<br />inside your wallet.
          </h1>
          <p className="text-[1.1rem] leading-[1.7] max-w-[600px]" style={{ color: "#6e6e73" }}>
            Games, tools, and services that open in a tap and disappear when you&apos;re done — no installs, no new accounts, no switching apps.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div style={{ height: "1px", background: "rgba(0,0,0,0.07)" }} />
      </div>

      {/* Showcase */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-black mb-10" style={{ fontSize: "1.6rem", letterSpacing: "-0.035em" }}>
          What&apos;s in the Hub.
        </h2>
        <ul role="list" className="mini-apps-grid grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {APPS.map((app) => (
            <li key={app.name} className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "#f5f5f7", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm">
                <Image src={app.icon} alt={app.name} width={48} height={48} className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold" style={{ fontSize: "0.9rem", letterSpacing: "-0.02em" }}>{app.name}</span>
                </div>
                <p className="text-[0.8rem] leading-[1.5]" style={{ color: "#6e6e73" }}>{app.desc}</p>
              </div>
              <span className="text-[0.65rem] font-bold tracking-[0.1em] uppercase mt-auto" style={{ color: "#174717" }}>{app.category}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Principles */}
      <section style={{ background: "#f5f5f7" }}>
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="font-black mb-10" style={{ fontSize: "1.8rem", letterSpacing: "-0.035em" }}>
            Built around trust.
          </h2>
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {PRINCIPLES.map((p) => (
              <div key={p.num} className="rounded-2xl p-6" style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="text-[0.65rem] font-black tracking-[0.15em] uppercase mb-4" style={{ color: "#174717" }}>{p.num}</div>
                <h3 className="font-bold mb-2" style={{ fontSize: "1.05rem", letterSpacing: "-0.025em" }}>{p.title}</h3>
                <p className="text-[0.875rem] leading-[1.7]" style={{ color: "#6e6e73" }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For developers */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-2xl p-10 flex flex-col items-start gap-4" style={{ background: "#174717" }}>
          <span className="text-[0.75rem] font-bold tracking-[0.12em] uppercase" style={{ color: "#B7EE7A" }}>
            For developers
          </span>
          <h2 className="font-black leading-tight max-w-[520px]" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", color: "#ffffff", letterSpacing: "-0.035em" }}>
            Anyone can build a mini app.
          </h2>
          <p className="text-[0.95rem] leading-[1.7] max-w-[520px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            Build with our TypeScript SDK, deploy to any HTTPS URL, and submit it from inside the app. Most reviews are done within 2–5 business days.
          </p>
          <Link
            href="/developers/guides?doc=miniapps-intro"
            className="mt-2 inline-flex items-center gap-2 text-[0.875rem] font-semibold transition-opacity hover:opacity-80"
            style={{ color: "#B7EE7A" }}
          >
            Read the Mini Apps guide
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center pb-24 px-6">
        <h2 className="font-black mb-4" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", letterSpacing: "-0.04em" }}>
          Want to be first?
        </h2>
        <p className="text-[0.95rem] mb-8" style={{ color: "#6e6e73" }}>
          Join the waitlist and get early access when we launch.
        </p>
        <Link
          href="/#waitlist"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-[0.95rem] font-semibold transition-opacity hover:opacity-85"
          style={{ background: "#174717", color: "#B7EE7A" }}
        >
          Join the waitlist
        </Link>
      </section>
      </main>

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
        @media (max-width: 900px) {
          .mini-apps-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
