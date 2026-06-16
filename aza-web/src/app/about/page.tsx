import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "About | Aza",
  description: "Aza is a mobile-first fintech platform built for Africa — instant transfers, encrypted chat, QR payments, and a mini-app hub. Made in Ghana.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    num: "01",
    title: "Speed is the product.",
    body: "Every second a transfer hangs is a second someone's waiting. We built Aza so that money moves as fast as a message.",
  },
  {
    num: "02",
    title: "Zero hidden costs.",
    body: "Peer-to-peer transfers on Aza are free. No surprise charges, no percentage skimmed off the top. Free means free.",
  },
  {
    num: "03",
    title: "Security is not optional.",
    body: "AES-256 encryption, TLS 1.3 in transit, E2EE chat, biometric auth, and Bank of Ghana–compliant KYC. Every layer matters.",
  },
  {
    num: "04",
    title: "Built for Africa, by Africa.",
    body: "Aza is designed for how people actually use money here — mobile-first, chat-first, and community-first.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: "#ffffff", color: "#1d1d1f" }}>
      <Navbar />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-[100px] pb-16">
        <div className="max-w-[720px]">
          <p className="text-[0.75rem] font-bold tracking-[0.15em] uppercase mb-5" style={{ color: "#174717" }}>
            About Aza
          </p>
          <h1
            className="font-black leading-tight mb-6"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", letterSpacing: "-0.04em", textWrap: "balance" }}
          >
            The money app Africa&nbsp;deserves.
          </h1>
          <p className="text-[1.1rem] leading-[1.7] max-w-[600px]" style={{ color: "#6e6e73" }}>
            Aza is a mobile-first platform for instant peer-to-peer transfers, encrypted chat, QR payments, and a growing hub of mini apps — all in one place, free of charge.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div style={{ height: "1px", background: "rgba(0,0,0,0.07)" }} />
      </div>

      {/* Story */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid gap-12" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <h2 className="font-black mb-5" style={{ fontSize: "1.5rem", letterSpacing: "-0.03em" }}>
              Where it started.
            </h2>
            <p className="text-[0.95rem] leading-[1.75]" style={{ color: "#6e6e73" }}>
              Aza started as a final-year project at KNUST, Ghana — built by someone who was tired of the friction in sending money to a friend across campus. Mobile money works, but it charges you. Bank transfers work, but they take hours. Chat apps are everywhere, but none of them let you pay inside the conversation.
            </p>
            <p className="text-[0.95rem] leading-[1.75] mt-4" style={{ color: "#6e6e73" }}>
              So we built the thing we wanted. A fast, secure, free money app — with chat built in from the start.
            </p>
          </div>
          <div>
            <h2 className="font-black mb-5" style={{ fontSize: "1.5rem", letterSpacing: "-0.03em" }}>
              Where we&apos;re going.
            </h2>
            <p className="text-[0.95rem] leading-[1.75]" style={{ color: "#6e6e73" }}>
              Ghana first. Then Nigeria, Senegal, Côte d&apos;Ivoire, and beyond. We&apos;re building a platform that works the way Africans actually use money — mobile, chat-driven, and community-led.
            </p>
            <p className="text-[0.95rem] leading-[1.75] mt-4" style={{ color: "#6e6e73" }}>
              Merchants, developers, and businesses are part of the plan too. A full API, mini-app platform, and business tools — all built on the same instant, zero-fee infrastructure.
            </p>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section style={{ background: "#f5f5f7" }}>
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="font-black mb-10" style={{ fontSize: "1.8rem", letterSpacing: "-0.035em" }}>
            What we believe.
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

      {/* Built in Ghana */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-2xl p-10 flex flex-col items-start gap-4" style={{ background: "#174717" }}>
          <span className="text-[0.75rem] font-bold tracking-[0.12em] uppercase" style={{ color: "#B7EE7A" }}>
            Made in Ghana 🇬🇭
          </span>
          <h2 className="font-black leading-tight max-w-[520px]" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", color: "#ffffff", letterSpacing: "-0.035em" }}>
            Regulated by the Bank of Ghana. Built for Ghanaians first.
          </h2>
          <p className="text-[0.95rem] leading-[1.7] max-w-[520px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            Aza operates under Bank of Ghana e-money regulations. KYC is powered by Ghana&apos;s National Identification Authority (NIA), and every transaction is logged, encrypted, and auditable.
          </p>
          <Link
            href="/security"
            className="mt-2 inline-flex items-center gap-2 text-[0.875rem] font-semibold transition-opacity hover:opacity-80"
            style={{ color: "#B7EE7A" }}
          >
            How we secure your money
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[0.75rem]" style={{ color: "#6e6e73" }}>
            &copy; {new Date().getFullYear()} Aza Systems Ltd. Made in Ghana.
          </p>
          <div className="flex gap-5 text-[0.75rem]" style={{ color: "#6e6e73" }}>
            <Link href="/privacy-policy" className="hover:opacity-70 transition-opacity">Privacy</Link>
            <Link href="/terms-of-service" className="hover:opacity-70 transition-opacity">Terms</Link>
            <Link href="/security" className="hover:opacity-70 transition-opacity">Security</Link>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 640px) {
          .grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
