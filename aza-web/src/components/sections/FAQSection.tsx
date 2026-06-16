"use client";

import { useState } from "react";

const faqs = [
  { q: "Is Aza free to use?",                  a: "Yes. Aza charges no hidden fees for peer-to-peer transfers between Aza users. Standard network charges may apply for top-ups or withdrawals to mobile money or bank accounts." },
  { q: "Which countries is Aza available in?",  a: "We're launching first in Ghana, with Nigeria, Kenya, and the rest of West Africa following shortly. Sign up for the waitlist to get notified when we reach your country." },
  { q: "Does the recipient need an Aza account?", a: "For instant wallet transfers, both sender and recipient need an Aza account. You can also withdraw your balance to any mobile money or bank account directly from the app." },
  { q: "Is my money safe on Aza?",              a: "All funds held on Aza are safeguarded in regulated bank accounts, separate from Aza's operating funds. Your account is protected by 256-bit AES encryption, biometric authentication, and KYC verification." },
  { q: "How long do transfers take?",           a: "Transfers between Aza users are instant — typically under 2 seconds. Withdrawals to mobile money complete within minutes; bank withdrawals may take up to one business day." },
  { q: "What is the Aza Hub?",                  a: "The Hub is Aza's built-in mini-app platform. Like a lightweight App Store inside Aza — access games, financial tools, bills payments, and more without leaving the app." },
  { q: "Can I build a mini-app on Aza?",        a: "Yes. Visit the Developer Portal to register, read the mini-app docs, and submit your app for review. Aza handles payments, authentication, and distribution." },
  { q: "How do I join the waitlist?",           a: "Scroll to the waitlist section and enter your email. You'll get an early-access invite when Aza launches in your region." },
];

function Item({ faq, open, onToggle }: { faq: typeof faqs[0]; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <button
        className="w-full flex items-center justify-between py-4 text-left gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174717] rounded"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="font-medium text-[0.95rem] leading-snug" style={{ color: "#1d1d1f", letterSpacing: "-0.01em" }}>
          {faq.q}
        </span>
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-200"
          style={{ background: open ? "#1d1d1f" : "rgba(0,0,0,0.06)", transform: open ? "rotate(45deg)" : "none" }}
          aria-hidden="true"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 2v6M2 5h6" stroke={open ? "#f5f5f7" : "#6e6e73"} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: open ? "300px" : "0px", opacity: open ? 1 : 0 }}
      >
        <p className="pb-4 text-[0.9rem] leading-[1.7] max-w-[600px]" style={{ color: "#6e6e73" }}>
          {faq.a}
        </p>
      </div>
    </div>
  );
}

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="apple-light section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">
        <div className="faq-layout flex gap-16 items-start">

          {/* Sticky header */}
          <div className="faq-header reveal shrink-0 w-[300px]">
            <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
              Questions,<br />answered.
            </h2>
            <p className="apple-body" style={{ color: "#6e6e73" }}>
              Can&apos;t find what you&apos;re looking for?{" "}
              <a href="mailto:support@aza.systems" className="underline underline-offset-2" style={{ color: "#174717" }}>
                Contact support
              </a>
            </p>
          </div>

          {/* Accordion */}
          <div className="flex-1 reveal" data-delay="80">
            {faqs.map((faq, i) => (
              <Item key={faq.q} faq={faq} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .faq-layout { flex-direction: column !important; gap: 2rem !important; }
          .faq-header { width: 100% !important; }
        }
      `}</style>
    </section>
  );
}
