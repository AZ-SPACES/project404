import { Slide } from "@/components/deck/Slide";
import { AUTHORS } from "@/lib/deck";
import { stagger } from "@/lib/utils";

const OPEN_ITEMS = [
  [
    "DEMI licence scope under Act 987",
    "Including agent registration, agent due diligence and per-agent reporting obligations to the Bank of Ghana. The controls exist; the authorisation does not yet.",
  ],
  [
    "Float-interest pass-through",
    "The current rule on passing a portion of safeguarded-float interest to e-money holders, which affects both the treasury model and the customer disclosure.",
  ],
  [
    "Partner bank for the safeguarded account",
    "With a statement feed the reconciliation module can consume automatically. Manual reconciliation does not scale beyond a pilot.",
  ],
  [
    "KYC tier limits",
    "To be reconciled against current directives before launch. The enforcement mechanism is built and tested; the thresholds are inputs.",
  ],
];

export function CloseSlide() {
  return (
    <Slide id="close">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        Open items
      </p>

      <h2 id="close-title" className="display mt-7 anim" style={stagger(1)}>
        The controls are built. The <span className="accent">authorisation</span> is the
        conversation.
      </h2>

      <ol className="mt-10 grid gap-x-12 gap-y-6 md:grid-cols-2">
        {OPEN_ITEMS.map(([term, body], i) => (
          <li key={term} className="anim border-t border-[var(--accent)] pt-4" style={stagger(2 + i)}>
            <h3 className="text-[0.98rem] font-semibold tracking-[-0.01em]">{term}</h3>
            <p className="body-sm mt-2">{body}</p>
          </li>
        ))}
      </ol>

      <hr className="rule mt-12 anim anim-fade" style={stagger(6)} />

      <div className="mt-8 flex flex-wrap gap-x-14 gap-y-6">
        {[
          ["Prepared by", AUTHORS],
          ["Live API", "api.aza.systems"],
          ["Controls verified", "9678fa5a · 2026-09-06"],
        ].map(([term, value], i) => (
          <div key={term} className="anim" style={stagger(7 + i)}>
            <p className="eyebrow" style={{ gap: "0.5rem" }}>
              {term}
            </p>
            <p className="mono mt-2 text-[0.92rem] text-[var(--text)]">{value}</p>
          </div>
        ))}
      </div>
    </Slide>
  );
}
