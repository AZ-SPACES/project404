import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const EXPERIMENTS = [
  {
    name: "Double-spend",
    setup: "100 parallel debits of GHS 1.00 from a wallet holding GHS 50.00",
    predicted: "Exactly 50 succeed, 50 rejected, 0 errors, final balance GHS 0.00",
    result: "Exactly as predicted",
  },
  {
    name: "Oversubscription",
    setup: "40 parallel debits of GHS 20.00 from GHS 50.00",
    predicted: "Two succeed, balance lands on GHS 10.00, never negative",
    result: "Confirmed",
  },
  {
    name: "Bidirectional deadlock",
    setup: "60 alternating A→B / B→A transfers in parallel",
    predicted: "Zero deadlock aborts; the pair still holds GHS 100.00 between them",
    result: "0 SQLSTATE 40P01, value conserved",
  },
];

export function ConcurrencySlide() {
  return (
    <Slide id="concurrency">
      <SlideHead
        id="concurrency"
        eyebrow="§12.5 · Correctness under concurrency"
        title={
          <>
            Not argued. <span className="accent">Measured</span>, against real PostgreSQL.
          </>
        }
        lede="Testcontainers boots PostgreSQL 16 and runs the full migration chain, so these execute against the production schema rather than an in-memory approximation of it."
      />

      <ul className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden lg:grid-cols-3">
        {EXPERIMENTS.map((experiment, i) => (
          <li key={experiment.name} className="bg-[var(--surface)] p-[clamp(1.1rem,2vw,1.7rem)] anim flex flex-col" style={stagger(3 + i)}>
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.015em]">{experiment.name}</h3>
            <p className="body-sm mt-3">{experiment.setup}</p>

            <hr className="rule my-4" />

            <p className="eyebrow">Predicted</p>
            <p className="body-sm mt-2 flex-1">{experiment.predicted}</p>

            <p className="mt-4 flex items-center gap-2.5">
              <span className="pill pill--ok">Pass</span>
              <span className="mono text-[0.78rem] accent">{experiment.result}</span>
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-x-12 gap-y-6 lg:grid-cols-2 anim" style={stagger(6)}>
        <p className="body-sm">
          <span className="text-[var(--text)] font-medium">What this establishes.</span> That the
          locking discipline is correct under contention on the paths exercised, at the database
          level rather than the application level — the failure mode is a serialised wait, not a
          lost update.
        </p>
        <p className="body-sm">
          <span className="text-[var(--text)] font-medium">What it does not.</span> It is a
          correctness experiment, not a throughput benchmark. Sustained-load performance figures
          remain an explicit handoff, and are listed as such on the limitations slide rather than
          implied by these results.
        </p>
      </div>
    </Slide>
  );
}
