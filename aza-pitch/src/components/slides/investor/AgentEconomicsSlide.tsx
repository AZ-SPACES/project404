import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { FeeTable, type FeeRow } from "./FeeTable";
import { stagger } from "@/lib/utils";

const ROWS: FeeRow[] = [
  { name: "Cash-in commission to the agent", kind: "pays", rate: "~0.2% of deposit, min ₵0.10", why: "Keeps agents motivated to accept deposits even though the user pays nothing. This is the acquisition cost of the whole model." },
  { name: "Cash-out commission to the agent", kind: "pays", rate: "~50% of the cash-out fee", why: "The agent’s main income — funded entirely from the user fee, never out of AZA’s pocket." },
  { name: "Agent onboarding kit", kind: "fee", rate: "₵50–150 one-time", why: "Signage, training and a starter float bonus that offsets it. Filters for serious agents; roughly cost-neutral." },
  { name: "Super-agent float rebalancing", kind: "free", rate: "₵0 — never charged", why: "Never tax liquidity movement. Illiquid agents are the number-one cause of agent-network failure, and a fee here would actively cause the failure mode." },
];

export function AgentEconomicsSlide() {
  return (
    <Slide id="agent-economics">
      <SlideHead
        id="agent-economics"
        eyebrow="Agent economics"
        title={
          <>
            Mostly a <span className="accent">cost line</span>, and it should be read that way.
          </>
        }
        lede="Agents are the distribution channel, not a revenue source. The only agent-side fee exists to filter unserious applicants, and float movement inside a downline is free by design."
      />

      <div className="anim" style={stagger(3)}>
        <FeeTable rows={ROWS} whatLabel="Line" />
      </div>

      <div className="mt-8 grid gap-x-12 gap-y-6 lg:grid-cols-2">
        <p className="body-sm anim border-l-2 border-[var(--accent)] pl-4" style={stagger(4)}>
          <span className="text-[var(--text)] font-medium">Commissions post in real time.</span>{" "}
          Every fee-bearing transaction resolves to a split — AZA revenue against agent commission
          — posted atomically in the same ledger entry as the transaction. Instant, visible income
          is the strongest agent-retention tool there is.
        </p>
        <p className="body-sm anim border-l-2 border-[var(--line-strong)] pl-4" style={stagger(5)}>
          <span className="text-[var(--text)] font-medium">No margin on float distribution.</span>{" "}
          A written invariant, enforced in code and covered by 17 tests: a super-agent moving float
          to a sub-agent is an internal transfer with no fee, no spread and no commission. It is
          what stops an agent hierarchy quietly becoming a fee cascade.
        </p>
      </div>
    </Slide>
  );
}
