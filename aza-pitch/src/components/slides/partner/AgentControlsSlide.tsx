import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const CONTROLS = [
  [
    "An agent can never debit a user wallet",
    "Cash-out works by the user generating a one-time code or QR in the app, which the agent then redeems. Redemption is the proof of payment. There is no code path by which an agent initiates a debit against a customer.",
  ],
  [
    "Agents cannot create float",
    "Float only enters an agent’s wallet from a verified bank deposit minted by back office under dual control, or from a super-agent’s existing float. No agent action increases the total e-money in issue.",
  ],
  [
    "Cash-specific AML rules",
    "CASH_IN and CASH_OUT are distinct transaction types with their own fees, limits and monitoring rules — structuring detection cares about cash specifically, and feeds the suspicious-transaction reporting module.",
  ],
  [
    "Agent onboarding is a KYB flow",
    "Agent role and tier, identity verification, location, liquidity limits and commission rate, reusing the merchant know-your-business flow. Approving an agent is itself a maker–checker action assigned to COMPLIANCE.",
  ],
  [
    "The hierarchy cannot form a cycle",
    "A super-agent’s sub-agents are fixed at creation, and adopting an existing agent into a downline is deliberately unsupported. That restriction is what makes a parent cycle impossible, and it is enforced by a database constraint rather than by convention.",
  ],
  [
    "Float movement is ledgered separately",
    "Every master-to-sub float movement writes its own ledger row, so the distribution network is auditable independently of the customer ledger.",
  ],
];

export function AgentControlsSlide() {
  return (
    <Slide id="agent-controls" dense>
      <SlideHead
        id="agent-controls"
        eyebrow="Agent network controls"
        title={
          <>
            The agent is a <span className="accent">counterparty</span>, and is modelled as one.
          </>
        }
        lede="Agent registration, agent due diligence and per-agent reporting are licence requirements under the Payment Systems and Services Act, 2019. These are the controls the system already implements against them."
      />

      <ul className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden md:grid-cols-2 lg:grid-cols-3">
        {CONTROLS.map(([term, body], i) => (
          <li key={term} className="bg-[var(--surface)] p-[clamp(1rem,1.8vw,1.5rem)] anim" style={stagger(3 + i)}>
            <h3 className="text-[0.98rem] font-semibold leading-snug tracking-[-0.01em]">{term}</h3>
            <p className="body-sm mt-2.5">{body}</p>
          </li>
        ))}
      </ul>
    </Slide>
  );
}
