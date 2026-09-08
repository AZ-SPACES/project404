import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const STAGES = [
  {
    n: "01",
    head: "Cash-in is free, forever",
    body:
      "Zero friction on money entering AZA. We pay the agent a small commission out of pocket — that is a customer-acquisition cost, not a loss, and it is never charged to the user.",
    tag: "Cost",
  },
  {
    n: "02",
    head: "Money inside is nearly free to move",
    body:
      "Every digital transaction — P2P, merchant payment, bill pay — is almost pure margin. No agent, no cash handling, no processor. Just our ledger.",
    tag: "Margin",
  },
  {
    n: "03",
    head: "Cash-out carries a fee",
    body:
      "Industry-standard everywhere, split with the agent. It earns revenue and it nudges users to keep money digital — which feeds stage 2.",
    tag: "Revenue",
  },
];

export function FlywheelSlide() {
  return (
    <Slide id="flywheel">
      <SlideHead
        id="flywheel"
        eyebrow="The business model"
        title={
          <>
            Cash is the on-ramp. We monetise{" "}
            <span className="accent">what happens between</span> the cash-in and the cash-out.
          </>
        }
        lede="The agent network itself is a cost centre — agents participate because we pay them commissions. That is the correct way to read it: the network buys the deposits, and the deposits are what get monetised."
      />

      <ol className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden lg:grid-cols-3">
        {STAGES.map((stage, i) => (
          <li key={stage.n} className="bg-[var(--surface)] p-[clamp(1.1rem,2vw,1.7rem)] anim flex flex-col" style={stagger(3 + i)}>
            <div className="flex items-center justify-between gap-3">
              <span className="mono text-[0.72rem] tracking-[0.18em] accent">{stage.n}</span>
              <span className="pill">{stage.tag}</span>
            </div>
            <h3 className="mt-4 text-[1.02rem] font-semibold leading-snug tracking-[-0.015em]">
              {stage.head}
            </h3>
            <p className="body-sm mt-3">{stage.body}</p>
          </li>
        ))}
      </ol>

      <div
        className="anim mt-9 rounded-[var(--radius)] border border-[var(--line-strong)] px-[clamp(1.2rem,3vw,2rem)] py-[clamp(1.1rem,2.5vh,1.7rem)]"
        style={stagger(6)}
      >
        <p className="eyebrow">The one metric that matters</p>
        <p className="mt-3 text-[clamp(1.05rem,2vw,1.5rem)] font-medium leading-snug tracking-[-0.02em]">
          The <span className="accent">digital ratio</span> — the share of value moving
          wallet-to-wallet or wallet-to-merchant without touching cash.
        </p>
        <p className="body-sm mt-3 max-w-[92ch]">
          Every point of shift from cash-out to merchant payment converts a commission-laden
          transaction into a nearly-free one. It is the number that decides whether this is a
          thin-margin agent business or a payments network, and it is the KPI the admin dashboard
          is built around.
        </p>
      </div>
    </Slide>
  );
}
