import { Slide } from "@/components/deck/Slide";
import { AUTHORS } from "@/lib/deck";
import { stagger } from "@/lib/utils";

const FIGURES = [
  { value: "9 / 9", label: "money invariants holding" },
  { value: "18", label: "actions under maker–checker" },
  { value: "3", label: "KYC tiers with enforced limits" },
  { value: "SHA-256", label: "daily audit anchor chain" },
];

export function CoverSlide() {
  return (
    <Slide id="cover">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        Partner and regulator brief · September 2026
      </p>

      <h1 id="cover-title" className="display mt-7 anim" style={stagger(1)}>
        A closed-loop e-money system built to be{" "}
        <span className="accent">examined</span>.
      </h1>

      <p className="lede mt-6 anim" style={stagger(2)}>
        AZA is a Ghana-only, GHS-only wallet running on internal rails. This brief covers the
        ledger, the safeguarding invariant, the agent controls, KYC and transaction monitoring,
        dual control over privileged actions, and the audit trail — and states plainly where the
        system’s regulatory position is unresolved.
      </p>

      <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-5 anim" style={stagger(3)}>
        {[
          ["Prepared by", AUTHORS],
          ["Scope", "Ghana · GHS only · no FX, no card rails"],
          ["Controls verified at", "9678fa5a · 2026-09-06"],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="eyebrow" style={{ gap: "0.5rem" }}>
              {term}
            </dt>
            <dd className="mt-2 text-[0.95rem] text-[var(--text)]">{value}</dd>
          </div>
        ))}
      </dl>

      <hr className="rule mt-12 anim anim-fade" style={stagger(4)} />

      <ul className="mt-7 flex flex-wrap gap-x-[clamp(2rem,6vw,5rem)] gap-y-6">
        {FIGURES.map((figure, i) => (
          <li key={figure.label} className="anim max-w-[18ch]" style={stagger(5 + i)}>
            <span className="mono block text-[clamp(1.5rem,3vw,2.3rem)] leading-none font-semibold tracking-tight">
              {figure.value}
            </span>
            <span className="body-sm mt-2 block">{figure.label}</span>
          </li>
        ))}
      </ul>
    </Slide>
  );
}
