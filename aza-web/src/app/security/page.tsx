import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Security | Aza",
  description: "How Aza protects your money and data: AES-256 encryption, TLS 1.3, end-to-end encrypted chat, biometric auth, and Bank of Ghana–compliant KYC.",
  alternates: { canonical: "/security" },
};

const LAYERS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 2L4 5v5c0 4.418 3.134 8.55 7 9.5C14.866 18.55 18 14.418 18 10V5L11 2z" stroke="#174717" strokeWidth="1.6" fill="rgba(23,71,23,0.08)" strokeLinejoin="round" />
        <path d="M8 11l2 2 4-4" stroke="#174717" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "AES-256 encryption at rest",
    body: "Every wallet balance, transaction record, and personal detail is encrypted with AES-256 before it touches disk. No plaintext data is ever stored.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="3" y="11" width="16" height="9" rx="2" stroke="#174717" strokeWidth="1.6" fill="rgba(23,71,23,0.08)" />
        <path d="M7 11V7a4 4 0 0 1 8 0v4" stroke="#174717" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="11" cy="15.5" r="1.5" fill="#174717" />
      </svg>
    ),
    title: "TLS 1.3 in transit",
    body: "All API traffic and WebSocket connections use TLS 1.3. Weak cipher suites and legacy TLS versions are explicitly rejected at the load balancer.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 3C7.134 3 4 6.134 4 10c0 2.5 1.3 4.7 3.25 6L8 20h6l.75-4C16.7 14.7 18 12.5 18 10c0-3.866-3.134-7-7-7z" stroke="#174717" strokeWidth="1.6" fill="rgba(23,71,23,0.08)" strokeLinejoin="round" />
        <path d="M8.5 9h5M8.5 12h3" stroke="#174717" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    title: "End-to-end encrypted chat",
    body: "Aza messages use the Signal Protocol — the same encryption used by Signal and WhatsApp. Keys are generated on device. We cannot read your conversations.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="5" y="2" width="12" height="18" rx="2.5" stroke="#174717" strokeWidth="1.6" fill="rgba(23,71,23,0.08)" />
        <circle cx="11" cy="10" r="2.5" stroke="#174717" strokeWidth="1.4" />
        <path d="M7.5 15.5c0-1.933 1.567-3.5 3.5-3.5s3.5 1.567 3.5 3.5" stroke="#174717" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    title: "Biometric & TOTP authentication",
    body: "Log in with Face ID, fingerprint, or a time-based one-time password. Account actions like transfers require a 4-digit passcode confirmed at the point of action.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="18" height="13" rx="2" stroke="#174717" strokeWidth="1.6" fill="rgba(23,71,23,0.08)" />
        <path d="M6 6V5a5 5 0 0 1 10 0v1" stroke="#174717" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8 12h6M8 15h4" stroke="#174717" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    title: "Bank of Ghana–compliant KYC",
    body: "Identity verification uses Ghana Card or passport via the National Identification Authority (NIA). Tiered limits (Tier 1–3) follow BoG e-money regulations.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="8" stroke="#174717" strokeWidth="1.6" fill="rgba(23,71,23,0.08)" />
        <path d="M11 7v4l2.5 2.5" stroke="#174717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 3.5L3.5 6M18 3.5L20.5 6" stroke="#174717" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    title: "Anomaly detection & holds",
    body: "High-risk transfers are intercepted automatically and held for compliance review. Rules are configurable and backed by transaction-level audit logs.",
  },
];

const CERTS = [
  { name: "Bank of Ghana", sub: "E-money licence (pending)" },
  { name: "NIA", sub: "Identity verification" },
  { name: "GhIPSS", sub: "Interoperable payments" },
  { name: "AES-256", sub: "NIST-certified encryption" },
  { name: "TLS 1.3", sub: "Transport security" },
  { name: "Signal Protocol", sub: "Chat encryption" },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen" style={{ background: "#ffffff", color: "#1d1d1f" }}>
      <Navbar />

      {/* Hero */}
      <section style={{ background: "#174717" }}>
        <div className="max-w-5xl mx-auto px-6 pt-[120px] pb-20">
          <p className="text-[0.75rem] font-bold tracking-[0.15em] uppercase mb-5" style={{ color: "#B7EE7A" }}>
            Security
          </p>
          <h1
            className="font-black leading-tight mb-6 max-w-[680px]"
            style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.2rem)", letterSpacing: "-0.04em", color: "#ffffff" }}
          >
            Your money is safe.<br />Here&apos;s exactly how.
          </h1>
          <p className="text-[1rem] leading-[1.7] max-w-[560px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            Security isn&apos;t a feature we added after the fact. Every layer of Aza — from the database to the phone screen — was designed with it in mind.
          </p>
        </div>
      </section>

      {/* Cert bar */}
      <section style={{ background: "#f5f5f7", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {CERTS.map((c, i) => (
              <div key={c.name} className="flex items-center gap-8">
                <div className="text-center min-w-[80px]">
                  <div className="text-[0.9rem] font-black" style={{ color: "#1d1d1f" }}>{c.name}</div>
                  <div className="text-[0.65rem] font-medium mt-0.5" style={{ color: "#6e6e73" }}>{c.sub}</div>
                </div>
                {i < CERTS.length - 1 && (
                  <div className="hidden sm:block h-8 w-px" style={{ background: "rgba(0,0,0,0.1)" }} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security layers */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-black mb-10" style={{ fontSize: "1.6rem", letterSpacing: "-0.035em" }}>
          Six layers of protection.
        </h2>
        <div className="security-grid grid gap-4" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {LAYERS.map((layer) => (
            <div
              key={layer.title}
              className="rounded-2xl p-6 flex gap-4"
              style={{ background: "#f5f5f7", border: "1px solid rgba(0,0,0,0.04)" }}
            >
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)" }}
              >
                {layer.icon}
              </div>
              <div>
                <h3 className="font-bold mb-1.5" style={{ fontSize: "0.95rem", letterSpacing: "-0.02em" }}>
                  {layer.title}
                </h3>
                <p className="text-[0.85rem] leading-[1.65]" style={{ color: "#6e6e73" }}>
                  {layer.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Responsible disclosure */}
      <section style={{ background: "#f5f5f7" }}>
        <div className="max-w-5xl mx-auto px-6 py-14">
          <div className="grid gap-10" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <h2 className="font-black mb-4" style={{ fontSize: "1.4rem", letterSpacing: "-0.03em" }}>
                Found a vulnerability?
              </h2>
              <p className="text-[0.9rem] leading-[1.7]" style={{ color: "#6e6e73" }}>
                We take security reports seriously. If you discover a potential vulnerability in Aza, please contact us directly before public disclosure. We aim to respond within 24 hours.
              </p>
              <a
                href="mailto:security@aza.systems"
                className="mt-5 inline-flex items-center gap-2 text-[0.875rem] font-semibold transition-opacity hover:opacity-70"
                style={{ color: "#174717" }}
              >
                security@aza.systems
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
            <div>
              <h2 className="font-black mb-4" style={{ fontSize: "1.4rem", letterSpacing: "-0.03em" }}>
                What we never do.
              </h2>
              <ul className="space-y-3 text-[0.875rem]" style={{ color: "#6e6e73" }}>
                {[
                  "Sell or share your personal data",
                  "Store your passcode or biometric data on our servers",
                  "Read your encrypted chat messages",
                  "Process transactions without your explicit confirmation",
                ].map((item) => (
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
          </div>
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
        @media (max-width: 640px) {
          .security-grid { grid-template-columns: 1fr !important; }
          .grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
