"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ROWS = [
  { label: "P2P transfer fee", aza: "₵0", momo: "0.5–2%", bank: "Fixed + %" },
  { label: "Transfer speed", aza: "<2 seconds", momo: "1–5 minutes", bank: "1–3 days" },
  { label: "Payment requests in chat", aza: true, momo: false, bank: false },
  { label: "In-app E2EE chat", aza: true, momo: false, bank: false },
  { label: "Voice & video calls", aza: true, momo: false, bank: false },
  { label: "QR payments", aza: true, momo: true, bank: false },
  { label: "Mini apps", aza: true, momo: false, bank: false },
  { label: "Monthly fee", aza: "₵0", momo: "Varies", bank: "Varies" },
];

function Cell({ v, highlight }: { v: string | boolean; highlight?: boolean }) {
  if (v === true) {
    return (
      <td
        className="py-3.5 px-4 text-center"
        style={{ background: highlight ? "rgba(23,71,23,0.06)" : "transparent" }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mx-auto" aria-label="Yes">
          <circle cx="9" cy="9" r="8.25" fill="#174717" fillOpacity="0.12" />
          <path d="M5.5 9l2.5 2.5 4.5-4" stroke="#174717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </td>
    );
  }
  if (v === false) {
    return (
      <td className="py-3.5 px-4 text-center" style={{ color: "#c7c7cc", fontSize: "0.85rem" }}>
        —
      </td>
    );
  }
  return (
    <td
      className="py-3.5 px-4 text-center text-[0.875rem] font-semibold"
      style={{
        color: highlight ? "#174717" : "#6e6e73",
        background: highlight ? "rgba(23,71,23,0.06)" : "transparent",
      }}
    >
      {v as string}
    </td>
  );
}

export function ComparisonSection() {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      tableRef.current,
      { y: 32, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.85,
        ease: "power3.out",
        scrollTrigger: {
          trigger: tableRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, []);

  return (
    <section id="compare" className="apple-white section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        <div className="text-center mb-12 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            Why Aza?
          </h2>
          <p className="apple-body max-w-[400px] mx-auto" style={{ color: "#6e6e73" }}>
            Fast, free, and built for the way you actually use money.
          </p>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table
            ref={tableRef}
            className="w-full border-collapse min-w-[560px]"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: "36%" }} />
              <col style={{ width: "21.33%" }} />
              <col style={{ width: "21.33%" }} />
              <col style={{ width: "21.33%" }} />
            </colgroup>

            <thead>
              <tr>
                <th className="pb-4 px-4 text-left text-[0.75rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "#6e6e73" }}>
                  Feature
                </th>
                <th className="pb-4 px-4 text-center">
                  <div
                    className="inline-block px-4 py-2 rounded-lg text-[0.875rem] font-black"
                    style={{ background: "#174717", color: "#B7EE7A" }}
                  >
                    Aza
                  </div>
                </th>
                <th className="pb-4 px-4 text-center text-[0.82rem] font-semibold" style={{ color: "#6e6e73" }}>
                  Mobile Money
                </th>
                <th className="pb-4 px-4 text-center text-[0.82rem] font-semibold" style={{ color: "#6e6e73" }}>
                  Bank Transfer
                </th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <td className="py-3.5 px-4 text-[0.875rem]" style={{ color: "#1d1d1f" }}>
                    {row.label}
                  </td>
                  <Cell v={row.aza} highlight />
                  <Cell v={row.momo} />
                  <Cell v={row.bank} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
