import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

type Status = "ok" | "warn";

const INVARIANTS: Array<{
  n: string;
  name: string;
  prevents: string;
  aug: [Status, string];
  sep: string;
}> = [
  { n: "1", name: "Balanced movement", prevents: "Money created from nothing", aug: ["ok", "Holds"], sep: "Now structural, via WalletLedger.transfer" },
  { n: "2", name: "Debit before external effect", prevents: "Money leaving on a callback that never arrives", aug: ["warn", "Partial — F2"], sep: "Holds — effects deferred to afterCommit" },
  { n: "3", name: "Tenant-scoped idempotency", prevents: "Duplicate charges on client retry", aug: ["ok", "Holds"], sep: "Holds — three further gaps closed" },
  { n: "4", name: "Concurrency-safe balance updates", prevents: "Double-spend under concurrency", aug: ["warn", "Unfalsified — F1"], sep: "Holds — three unlocked writers found and closed" },
  { n: "5", name: "BigDecimal only", prevents: "Silent rounding loss; negative amounts", aug: ["ok", "grep-verified"], sep: "Holds — asserted at schema level by MigrationChainIT" },
  { n: "6", name: "AuthZ + passcode + maker–checker", prevents: "One admin moving funds alone", aug: ["ok", "Holds"], sep: "Holds — extended to float and merchant pricing" },
  { n: "7", name: "GHS-only product scope", prevents: "Unbounded scope creep", aug: ["ok", "grep-verified"], sep: "Holds" },
  { n: "8", name: "No margin on float distribution", prevents: "An agent hierarchy becoming a fee cascade", aug: ["warn", "Vacuous — F3"], sep: "Holds — SuperAgentService built, 17 tests" },
  { n: "9", name: "Audit trail", prevents: "Unreconcilable breaks; unprovable disputes", aug: ["ok", "Holds"], sep: "Holds — float_distributions ledger added" },
];

export function InvariantsSlide() {
  return (
    <Slide id="invariants" dense>
      <SlideHead
        id="invariants"
        eyebrow="§5.4 · The financial invariants"
        title={
          <>
            Nine written rules for money code — enforced by a{" "}
            <span className="accent">documented review gate</span>.
          </>
        }
        lede="All nine now hold unconditionally. That sentence is worth less than how they got there, so both columns are shown: the movement between them is the evidence, not the final state."
      />

      <div className="scroll-x anim" style={stagger(3)}>
        <table className="dtable min-w-[820px]">
          <thead>
            <tr>
              <th style={{ width: "1.5rem" }}>#</th>
              <th>Invariant</th>
              <th>Failure mode it prevents</th>
              <th>2026-08-21</th>
              <th>2026-09-06</th>
            </tr>
          </thead>
          <tbody>
            {INVARIANTS.map((inv) => (
              <tr key={inv.n}>
                <td className="mono text-[var(--text-tertiary)]">{inv.n}</td>
                <td className="font-medium whitespace-nowrap">{inv.name}</td>
                <td>{inv.prevents}</td>
                <td>
                  <span className={`pill pill--${inv.aug[0]}`}>{inv.aug[1]}</span>
                </td>
                <td>
                  <span className="pill pill--ok">Holds</span>
                  <span className="block mt-1.5 text-[0.78rem] text-[var(--text-tertiary)]">
                    {inv.sep}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Slide>
  );
}
