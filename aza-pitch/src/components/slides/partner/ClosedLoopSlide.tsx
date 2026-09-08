import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

export function ClosedLoopSlide() {
  return (
    <Slide id="closed-loop">
      <SlideHead
        id="closed-loop"
        eyebrow="The ledger"
        title={
          <>
            Every credit has a matching debit, in the{" "}
            <span className="accent">same database transaction</span>.
          </>
        }
        lede="Wallet-to-wallet transfers, chat payments, merchant payments, money requests, agent cash-in and cash-out all settle internally. A single Spring Boot application owns every write to a balance; no surface holds its own."
      />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-3 items-start">
        {[
          [
            "One transactional boundary",
            "The debit, the credit, the transaction record and the audit entry commit together or not at all. There is no window in which value exists on one side and not the other.",
          ],
          [
            "External effects come after",
            "Every push, SMS, webhook and risk evaluation is deferred until after the commit. A notification that never arrives cannot leave money in an indeterminate state.",
          ],
          [
            "Concurrency held at the database",
            "Balance updates take a row lock at a single chokepoint rather than being read-modify-written in application code, so two simultaneous debits serialise instead of racing.",
          ],
        ].map(([term, body], i) => (
          <div key={term} className="anim" style={stagger(3 + i)}>
            <h3 className="text-[1.02rem] font-semibold tracking-[-0.015em]">{term}</h3>
            <p className="body-sm mt-3">{body}</p>
          </div>
        ))}
      </div>

      <div
        className="anim mt-10 rounded-[var(--radius)] border border-[var(--line-strong)] px-[clamp(1.2rem,3vw,2rem)] py-[clamp(1.1rem,2.5vh,1.7rem)]"
        style={stagger(6)}
      >
        <p className="eyebrow">Measured, not asserted</p>
        <p className="body-sm mt-3 max-w-[96ch]">
          Under 100 parallel debits of GHS 1.00 against a wallet holding GHS 50.00, exactly 50
          succeed and 50 are rejected, with a final balance of GHS 0.00 and no errors. Sixty
          alternating bidirectional transfers produce zero deadlock aborts and conserve value
          exactly. These run in continuous integration against a real PostgreSQL instance with the
          full migration chain applied.
        </p>
      </div>
    </Slide>
  );
}
