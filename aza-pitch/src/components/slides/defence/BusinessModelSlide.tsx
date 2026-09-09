import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { FlywheelFigure } from "@/components/slides/defence/Diagrams";
import { stagger } from "@/lib/utils";

/* Condensed from the investor track (flywheel + unit economics + positioning).
   The one rule carried over intact is the disclaimer: these are suggested rates
   modelled to show the shape of the margin, and there is no live volume. Saying
   so unprompted is what stops it becoming the question that eats the Q&A. */
const SCENARIOS: Array<[string, string, string]> = [
  ["₵100 in → transferred → withdrawn as cash", "₵0.50 P2P + ₵1.00 cash-out, less ₵0.70 agent commission", "≈ ₵0.80"],
  ["₵100 in → spent at a merchant", "₵1.00 merchant discount rate, less ₵0.20 cash-in commission", "≈ ₵0.80–1.30"],
  ["₵100 in → held 30 days → spent", "₵1.00 MDR + ~₵0.15 net float interest, less ₵0.20", "≈ ₵0.95–1.45"],
];

const PRINCIPLES: Array<[string, string]> = [
  ["Free where users compare", "Opening an account, receiving, sending to a friend, paying a shop. Free forever, and said loudly."],
  ["Charge businesses, not people", "Merchants, billers and employers pay for instant settlement and reconciled payouts. Consumers never see it."],
  ["Charge cash, not digital", "Cash-out is the only consumer fee of any size — and it pays the human agent who handed you the notes."],
];

export function BusinessModelSlide() {
  return (
    <Slide id="business-model" dense>
      <SlideHead
        id="business-model"
        eyebrow="Sustainability · how AZA earns"
        title={
          <>
            Cash is the on-ramp. We monetise{" "}
            <span className="accent">what happens between</span> the cash-in and the cash-out.
          </>
        }
        lede="The agent network is a cost centre — agents participate because they are paid commission. The network buys the deposits, and the deposits are what get monetised."
      />

      <div className="grid gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-8 lg:grid-cols-[0.72fr_1.28fr] items-start">
        <div className="anim max-w-[320px] mx-auto lg:mx-0" style={stagger(3)}>
          <FlywheelFigure />
        </div>

        <div className="space-y-[clamp(1.2rem,2.6vh,1.9rem)]">
          <div className="anim" style={stagger(4)}>
            <h3 className="eyebrow">What ₵100 is worth, depending on how it leaves</h3>
            <div className="scroll-x">
              <table className="dtable mt-4 min-w-[520px]">
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>Revenue, less agent cost</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIOS.map(([path, revenue, net]) => (
                    <tr key={path}>
                      <td className="font-medium">{path}</td>
                      <td>{revenue}</td>
                      <td className="num accent font-semibold whitespace-nowrap">{net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="body-sm mt-3.5 border-l-2 border-[var(--warn)] pl-4">
              <span className="text-[var(--text)] font-medium">Illustrative, against suggested
              rates.</span>{" "}
              There is no live transaction volume. These model the shape of the margin — the same
              deposit earns roughly twice as much spent digitally as withdrawn as cash, which is
              the entire strategy.
            </p>
          </div>

          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
            {PRINCIPLES.map(([term, body], i) => (
              <li key={term} className="anim border-t border-[var(--line)] pt-3" style={stagger(5 + i)}>
                <h4 className="text-[0.92rem] font-semibold tracking-[-0.01em]">{term}</h4>
                <p className="body-sm mt-1.5">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Slide>
  );
}
