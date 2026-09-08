import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const PRINCIPLES = [
  ["Free where users compare", "Opening an account, receiving money, sending to friends, paying a shop, checking a balance, getting a statement. Free forever — and said loudly."],
  ["Charge businesses, not people", "Merchants, billers, telcos and employers pay because AZA delivers them measurable value: instant settlement, cheap collections, reconciled payouts. Consumers never see these fees."],
  ["Charge cash, not digital", "The only consumer fee of any size is cash-out, which every competitor charges. Framing: it pays the human agent who handed you physical cash — which is true."],
  ["Free tiers, not free everything", "Where consumers are charged, a generous free tier means the typical user pays ₵0 forever, while the top 5% of senders — the least price-sensitive — fund the system."],
];

const COMMS = [
  "One public fee page. A single short plain-language table. No asterisks, no “up to”, no schedule-of-charges PDF buried in legal.",
  "Show the fee before confirmation, every time — including “Fee: ₵0.00”. Making free visible is marketing.",
  "Explain the why in one line: “the withdrawal fee pays the agent who serves you cash.”",
  "Never introduce a fee silently. Any new fee ships with 30 days’ in-app notice. Fee surprises are how the brand dies.",
];

export function BrandSlide() {
  return (
    <Slide id="brand" dense>
      <SlideHead
        id="brand"
        eyebrow="Positioning"
        title={
          <>
            The goal is not to be free everywhere. It is to be free{" "}
            <span className="accent">everywhere the user is looking</span>.
          </>
        }
        lede="“Free” is the brand weapon against both banks, which are fee-heavy, and MoMo, which charges for transfers. Free everywhere would just be unprofitable."
      />

      <div className="grid gap-x-14 gap-y-9 lg:grid-cols-[1.1fr_0.9fr] items-start">
        <div>
          <h3 className="eyebrow anim" style={stagger(3)}>
            The four principles
          </h3>
          <ol className="mt-5 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map(([term, body], i) => (
              <li key={term} className="anim border-t border-[var(--line)] pt-4" style={stagger(4 + i)}>
                <h4 className="text-[0.95rem] font-semibold tracking-[-0.01em]">{term}</h4>
                <p className="body-sm mt-2">{body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="anim" style={stagger(8)}>
          <h3 className="eyebrow">How fees get communicated</h3>
          <ul className="mt-5 space-y-3">
            {COMMS.map((item) => (
              <li key={item} className="body-sm flex gap-3">
                <span aria-hidden="true" className="accent mono pt-px">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="body-sm mt-5 border-l-2 border-[var(--accent)] pl-4">
            Marketing leads with the comparison, not the feature list: sending ₵50 to a friend —
            AZA free, others not.
          </p>
        </div>
      </div>
    </Slide>
  );
}
