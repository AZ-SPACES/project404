import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const IS = [
  "A closed-loop internal transfer system. Value moves between AZA wallets on AZA’s own double-entry ledger.",
  "Ghana only, Ghanaian Cedi only. No FX path exists anywhere in the codebase.",
  "Built with controls modelled on Bank of Ghana e-money and KYC expectations: tiered limits, transaction monitoring, sanctions screening, dual control, regulatory reporting.",
  "Designed so the safeguarding position is continuously reconcilable rather than periodically asserted.",
];

const IS_NOT = [
  "Not a licensed institution. The controls are modelled on regulatory expectations; the system has not been through supervisory approval.",
  "Not interconnected with MNO mobile-money switches or GhIPSS. The architecture accommodates it; no live rail is integrated.",
  "Not a card acquirer or issuer.",
  "Not operating an agent network yet — which is precisely the step that brings DEMI obligations under Act 987 into scope.",
];

export function PositionSlide() {
  return (
    <Slide id="position">
      <SlideHead
        id="position"
        eyebrow="Our position"
        title={
          <>
            Stated first, so nothing here has to be{" "}
            <span className="accent">discovered later</span>.
          </>
        }
      />

      <div className="grid gap-x-14 gap-y-9 lg:grid-cols-2">
        <div className="anim" style={stagger(3)}>
          <h3 className="eyebrow">What AZA is</h3>
          <ul className="mt-5 space-y-3">
            {IS.map((item) => (
              <li key={item} className="body-sm flex gap-3">
                <span aria-hidden="true" className="accent mono pt-px">
                  +
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">What AZA is not</h3>
          <ul className="mt-5 space-y-3">
            {IS_NOT.map((item) => (
              <li key={item} className="body-sm flex gap-3">
                <span aria-hidden="true" className="mono pt-px" style={{ color: "var(--bad)" }}>
                  −
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="body-sm mt-9 anim border-l-2 border-[var(--warn)] pl-4 max-w-[94ch]" style={stagger(5)}>
        <span className="text-[var(--text)] font-medium">One caveat carried throughout.</span> The
        KYC tier limits shown later are placeholders — the enum that holds them says so in its own
        source comment — and must be reconciled against current Bank of Ghana directives before
        launch. They are presented as the enforcement mechanism, not as regulatory fact.
      </p>
    </Slide>
  );
}
