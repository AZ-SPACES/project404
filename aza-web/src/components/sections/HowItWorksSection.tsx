import React from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";

const steps = [
  {
    num: "01",
    title: "Create your account",
    desc: "Sign up with your phone number or email. Our quick onboarding gets you set up in under two minutes.",
  },
  {
    num: "02",
    title: "Verify your identity",
    desc: "Complete a quick KYC check with your ID and a selfie. Your data is encrypted end-to-end.",
  },
  {
    num: "03",
    title: "Send & receive instantly",
    desc: "You're ready. Send money, request funds, chat, scan, and explore the Hub — all from one app.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section-py" style={{ background: "var(--aza-bg)" }}>
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
        <SectionHeader
          label="Simple by design"
          heading="Up and running in minutes"
        />

        <div className="steps-layout flex items-start max-w-[900px] mx-auto">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="reveal flex-1 text-center px-6" data-delay={String(i * 120)}>
                <div
                  className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-[1.1rem] font-black mx-auto mb-6"
                  style={{ background: "#174717", color: "#B7EE7A", boxShadow: "0 4px 16px rgba(23,71,23,0.25)" }}
                >
                  {s.num}
                </div>
                <h3 className="text-[1.2rem] font-semibold mb-2" style={{ color: "var(--aza-text)" }}>{s.title}</h3>
                <p className="text-[0.9rem] leading-[1.6]" style={{ color: "var(--aza-text-secondary)" }}>{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div key={`connector-${i}`} className="step__connector reveal" data-delay={String(i * 120 + 80)} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
