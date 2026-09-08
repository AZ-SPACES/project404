import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const CONTROLS: Array<[string, string, string]> = [
  ["Balanced movement", "Money created from nothing", "Debit and credit in one transactional boundary, through a single ledger entry point"],
  ["Debit before external effect", "Value leaving on a callback that never arrives", "Every notification, webhook and provider call deferred to after commit"],
  ["Tenant-scoped idempotency", "Duplicate charges on retry; cross-tenant leakage", "Unique idempotency key per tenant on every money-moving endpoint"],
  ["Concurrency-safe updates", "Double-spend under load", "Row locking at a single chokepoint, with canonical lock ordering"],
  ["Exact decimals only", "Silent rounding loss; negative amounts", "NUMERIC(15,2) columns, asserted at schema level by an integration test"],
  ["AuthZ, passcode, dual control", "One person moving funds alone", "4-digit passcode on consumer money flows; maker–checker on privileged actions"],
  ["Product scope", "Unbounded scope creep", "GHS-only, Ghana-only, internal rails; any FX path is treated as a defect"],
  ["No margin on float distribution", "An agent hierarchy becoming a fee cascade", "Super-agent to sub-agent float movement carries no fee, spread or commission"],
  ["Audit trail", "Unreconcilable breaks; unprovable disputes", "Ledger record written inside the same transaction, with reconciliation metadata"],
];

export function ControlsSlide() {
  return (
    <Slide id="controls" dense>
      <SlideHead
        id="controls"
        eyebrow="Money controls"
        title={
          <>
            Nine written rules, enforced by a{" "}
            <span className="accent">blocking review gate</span>.
          </>
        }
        lede="Any change touching wallets, transfers, payouts, withdrawals, agent float or checkout must pass a review that verifies each of these explicitly and ends in a Block or an Approve. “Nothing jumped out” does not constitute approval."
      />

      <div className="scroll-x anim" style={stagger(3)}>
        <table className="dtable min-w-[760px]">
          <thead>
            <tr>
              <th style={{ width: "1.5rem" }}>#</th>
              <th>Control</th>
              <th>Failure mode it prevents</th>
              <th>How it is enforced</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map(([name, prevents, how], i) => (
              <tr key={name}>
                <td className="mono text-[var(--text-tertiary)]">{i + 1}</td>
                <td className="font-medium whitespace-nowrap">{name}</td>
                <td>{prevents}</td>
                <td>{how}</td>
                <td>
                  <span className="pill pill--ok">Holds</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="body-sm mt-6 anim max-w-[96ch]" style={stagger(4)}>
        Two independent verification passes were run against the codebase, on 2026-08-21 and
        2026-09-06. The first found two of these not holding as written and a third that governed
        no live code at all; the second found three unlocked wallet writers and three missing
        idempotency keys. Every one is now closed and covered by tests. The record of what did not
        hold is available on request — a control framework that has never caught anything has not
        been tested.
      </p>
    </Slide>
  );
}
