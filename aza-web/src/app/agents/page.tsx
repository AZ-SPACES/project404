import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Agents | Aza",
  description: "Aza Agents are real people who turn cash into wallet balance and back again — find one nearby, or apply to become one and earn commission.",
  alternates: { canonical: "/agents" },
};

const STEPS = [
  {
    num: "01",
    title: "Cash in",
    body: "Hand an agent cash, give them your phone number, username, or email — they send it straight into your Aza wallet. It's free, and it lands instantly.",
  },
  {
    num: "02",
    title: "Cash out",
    body: "Generate a one-time withdrawal code in the app. Take it to any agent, show the code, and they hand you cash on the spot.",
  },
];

const EARNINGS = [
  {
    title: "Commission on every cash-in",
    body: "Agents earn a commission on every cash deposit they process for a customer — paid out as a payable, settled separately from customer funds.",
  },
  {
    title: "A share of withdrawal fees",
    body: "When you redeem a customer's withdrawal code, you earn a share of the fee charged for that cash-out.",
  },
  {
    title: "Tiered rates as you grow",
    body: "Process more volume and move up to a higher commission tier.",
  },
];

const REQUIREMENTS = [
  "A valid Ghana Card or passport",
  "A registered business name",
  "Expected monthly transaction volume",
  "Approval through Aza's compliance review",
];

export default function AgentsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#ffffff", color: "#1d1d1f" }}>
      <Navbar />

      <main>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-[100px] pb-16">
        <div className="max-w-[720px]">
          <p className="text-[0.75rem] font-bold tracking-[0.15em] uppercase mb-5" style={{ color: "#174717" }}>
            Aza Agents
          </p>
          <h1
            className="font-black leading-tight mb-6"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", letterSpacing: "-0.04em", textWrap: "balance" }}
          >
            Cash in, cash out.<br />Anywhere.
          </h1>
          <p className="text-[1.1rem] leading-[1.7] max-w-[600px]" style={{ color: "#6e6e73" }}>
            Aza Agents are real people in your community who turn cash into wallet balance — and wallet balance back into cash. No bank branch, no long queue.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div style={{ height: "1px", background: "rgba(0,0,0,0.07)" }} />
      </div>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-black mb-10" style={{ fontSize: "1.6rem", letterSpacing: "-0.035em" }}>
          How it works.
        </h2>
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {STEPS.map((s) => (
            <div key={s.num} className="rounded-2xl p-6" style={{ background: "#f5f5f7", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="text-[0.65rem] font-black tracking-[0.15em] uppercase mb-4" style={{ color: "#174717" }}>{s.num}</div>
              <h3 className="font-bold mb-2" style={{ fontSize: "1.1rem", letterSpacing: "-0.025em" }}>{s.title}</h3>
              <p className="text-[0.9rem] leading-[1.7]" style={{ color: "#6e6e73" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Become an agent */}
      <section style={{ background: "#f5f5f7" }}>
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid gap-12" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <h2 className="font-black mb-5" style={{ fontSize: "1.5rem", letterSpacing: "-0.03em" }}>
                Become an agent.
              </h2>
              <p className="text-[0.95rem] leading-[1.75] mb-8" style={{ color: "#6e6e73" }}>
                Run a shop, a kiosk, or a mobile money stand? Add Aza cash-in and cash-out to what you already do, and earn on every transaction you process.
              </p>
              <ul className="space-y-3 text-[0.875rem]" style={{ color: "#6e6e73" }}>
                {REQUIREMENTS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="#174717" strokeWidth="1.4" fill="rgba(23,71,23,0.06)" />
                      <path d="M5 8.5l2 2 4-4" stroke="#174717" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              {EARNINGS.map((e) => (
                <div key={e.title} className="rounded-2xl p-6" style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <h3 className="font-bold mb-1.5" style={{ fontSize: "0.95rem", letterSpacing: "-0.02em" }}>{e.title}</h3>
                  <p className="text-[0.85rem] leading-[1.65]" style={{ color: "#6e6e73" }}>{e.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Made in Ghana style apply note */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-2xl p-10 flex flex-col items-start gap-4" style={{ background: "#174717" }}>
          <span className="text-[0.75rem] font-bold tracking-[0.12em] uppercase" style={{ color: "#B7EE7A" }}>
            Apply in the app
          </span>
          <h2 className="font-black leading-tight max-w-[520px]" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", color: "#ffffff", letterSpacing: "-0.035em" }}>
            Agent applications go through Aza&apos;s compliance review.
          </h2>
          <p className="text-[0.95rem] leading-[1.7] max-w-[520px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            Download Aza, open the agent application from your profile, and submit your details. We&apos;ll review and get back to you.
          </p>
          <Link
            href="/#waitlist"
            className="mt-2 inline-flex items-center gap-2 text-[0.875rem] font-semibold transition-opacity hover:opacity-80"
            style={{ color: "#B7EE7A" }}
          >
            Join the waitlist
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
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
        @media (max-width: 640px) {
          .grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
