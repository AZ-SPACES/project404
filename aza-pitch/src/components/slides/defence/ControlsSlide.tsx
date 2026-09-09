import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

/* Condensed from the partner and regulator track. This slide exists to answer the
   licensing question before it is asked — it is the single most likely question in
   the room, and conceding it under pressure reads very differently from stating it. */
const CONTROLS: Array<[string, string]> = [
  ["Tiered KYC", "Three tiers with single, daily, monthly and wallet-ceiling caps, enforced at one guard shared by every money path."],
  ["Transaction monitoring", "Large-value, velocity and structuring rules on every completed transfer, with thresholds tunable without a deploy."],
  ["Maker–checker", "Eighteen privileged actions need a second approver. Self-approval is rejected — including for administrators."],
  ["Safeguarding", "Agent float, merchant balances and platform revenue are separate wallet classes, so the customer-funds position is continuously reconcilable."],
];

const ASYMMETRY: Array<[string, string]> = [
  ["Freeze a wallet", "Unfreeze it"],
  ["Suspend a user", "Reactivate them"],
  ["Reject a KYC application", "Approve one"],
];

export function ControlsSlide() {
  return (
    <Slide id="controls">
      <SlideHead
        id="controls"
        eyebrow="Regulatory position · stated, not defended"
        title={
          <>
            The system implements the controls. It makes{" "}
            <span className="accent">no claim to the licence</span>.
          </>
        }
        lede="Controls are modelled on Bank of Ghana e-money and KYC expectations. AZA is not a licensed EMI, is not interconnected with GhIPSS or the MNO switches, and the tier limits are placeholders — the enum says so in its own source comment."
      />

      <div className="grid gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-8 lg:grid-cols-[1.25fr_0.75fr] items-start">
        <ul className="grid gap-x-9 gap-y-5 sm:grid-cols-2">
          {CONTROLS.map(([term, body], i) => (
            <li key={term} className="anim border-t border-[var(--line)] pt-3.5" style={stagger(3 + i)}>
              <h3 className="text-[0.95rem] font-semibold tracking-[-0.01em]">{term}</h3>
              <p className="body-sm mt-1.5">{body}</p>
            </li>
          ))}
        </ul>

        <div className="anim" style={stagger(7)}>
          <h3 className="eyebrow">The deliberate asymmetry</h3>
          <p className="body-sm mt-3">
            The restrictive direction is immediate. The permissive direction needs approval.
          </p>
          <ul className="mt-4 space-y-2.5">
            {ASYMMETRY.map(([immediate, gated]) => (
              <li key={immediate} className="flex items-center gap-3 text-[0.85rem]">
                <span className="pill pill--ok" style={{ minWidth: "9.5rem" }}>
                  {immediate}
                </span>
                <span aria-hidden="true" className="dim mono">
                  &rarr;
                </span>
                <span className="pill pill--warn">{gated}</span>
              </li>
            ))}
          </ul>
          <p className="body-sm mt-4 border-l-2 border-[var(--accent)] pl-4">
            A single staff member can always act to{" "}
            <span className="text-[var(--text)]">reduce</span> risk, and never alone to{" "}
            <span className="text-[var(--text)]">increase</span> it.
          </p>
        </div>
      </div>
    </Slide>
  );
}
