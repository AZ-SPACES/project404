import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const PHASES = [
  {
    n: "Phase 1",
    name: "Pilot",
    launches:
      "Bank-transfer deposits with manual credit, plus a small agent pilot of 10–30 agents. Everything consumer-side free except cash-out.",
    earns: "Cash-out fees and float interest. Expect near-breakeven — the goal is liquidity learning, not margin.",
  },
  {
    n: "Phase 2",
    name: "Merchant push",
    launches:
      "MDR switched on with a free micro-tier. Bill pay and airtime through partners, bulk disbursements, instant payout fees.",
    earns: "MDR and commissions become the main lines. The digital ratio becomes the reported KPI.",
  },
  {
    n: "Phase 3",
    name: "Scale",
    launches:
      "AZA Plus premium tier, mini-app revenue share, and micro-credit with a licensed partner.",
    earns: "Recurring subscription revenue plus credit facilitation.",
  },
];

export function RoadmapSlide() {
  return (
    <Slide id="roadmap">
      <SlideHead
        id="roadmap"
        eyebrow="Sequencing"
        title={
          <>
            Liquidity first. Margin <span className="accent">second</span>.
          </>
        }
        lede="An agent network that runs out of float fails before it can be monetised, so phase 1 is deliberately near-breakeven and optimises for learning how cash actually moves through the network."
      />

      <ol className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden lg:grid-cols-3">
        {PHASES.map((phase, i) => (
          <li key={phase.n} className="bg-[var(--surface)] p-[clamp(1.1rem,2vw,1.7rem)] anim flex flex-col" style={stagger(3 + i)}>
            <span className="mono text-[0.72rem] tracking-[0.16em] accent">{phase.n}</span>
            <h3 className="mt-3 text-[1.15rem] font-semibold tracking-[-0.02em]">{phase.name}</h3>

            <h4 className="eyebrow mt-5">What launches</h4>
            <p className="body-sm mt-2 flex-1">{phase.launches}</p>

            <h4 className="eyebrow mt-5">What earns</h4>
            <p className="body-sm mt-2">{phase.earns}</p>
          </li>
        ))}
      </ol>

      <p className="body-sm mt-8 anim max-w-[96ch]" style={stagger(6)}>
        <span className="text-[var(--text)] font-medium">Two engine mechanisms come first</span>,
        and both are configurable by design: a fee engine holding schedules as versioned data with
        effective dates, edited under maker–checker so every change is auditable and reversible —
        and automatic commission splits that post atomically with the transaction. The fee quoted
        at confirmation must be the fee charged, from the same schedule version.
      </p>
    </Slide>
  );
}
