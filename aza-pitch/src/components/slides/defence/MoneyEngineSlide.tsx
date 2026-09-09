import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { BoundaryFigure } from "@/components/slides/defence/Diagrams";
import { stagger } from "@/lib/utils";

/* The three concurrency experiments, stated as claim → measurement. These are the
   strongest engineering evidence in the project, so they are on the same slide as
   the mechanism that produces them rather than three slides later. */
const EXPERIMENTS: Array<[string, string, string]> = [
  ["Double-spend", "100 parallel debits of ₵1.00 from a ₵50.00 wallet", "50 succeed, 50 rejected, balance ₵0.00"],
  ["Oversubscription", "40 parallel debits of ₵20.00 from ₵50.00", "Two succeed, lands on ₵10.00, never negative"],
  ["Deadlock", "60 alternating A→B / B→A transfers", "0 deadlock aborts, value conserved"],
];

export function MoneyEngineSlide() {
  return (
    <Slide id="money-engine" dense>
      <SlideHead
        id="money-engine"
        eyebrow="§5.3–5.4 · The money engine"
        title={
          <>
            Nine written rules for money code — and{" "}
            <span className="accent">nine of nine now hold</span>.
          </>
        }
        lede="Every balance mutation commits inside one boundary; every external effect happens after it. Correctness under contention is measured, not argued."
      />

      <div className="grid gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-8 lg:grid-cols-[0.85fr_1.15fr] items-start">
        <div className="anim max-w-[420px]" style={stagger(3)}>
          <BoundaryFigure />
        </div>

        <div className="space-y-[clamp(1.2rem,2.6vh,1.9rem)]">
          <div className="anim" style={stagger(4)}>
            <h3 className="eyebrow">Measured, in CI, against PostgreSQL 16</h3>
            <ul className="mt-4 space-y-3">
              {EXPERIMENTS.map(([name, setup, result]) => (
                <li key={name} className="border-t border-[var(--line)] pt-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[0.93rem] font-semibold">{name}</span>
                    <span className="pill pill--ok">Pass</span>
                  </div>
                  <p className="body-sm mt-1.5">{setup}</p>
                  <p className="body-sm mt-1 accent mono text-[0.8rem]">{result}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="anim card" style={stagger(5)}>
            <h3 className="eyebrow">Why the invariants are the contribution</h3>
            <p className="body-sm mt-3">
              Six of nine held at the first audit. Invariant 4 was verified by tracing every{" "}
              <span className="text-[var(--text)]">documented</span> money path — and three
              writers on undocumented paths took no lock. Enforcement by construction beats
              verification by inspection, and that counter-example is the proof.
            </p>
          </div>
        </div>
      </div>
    </Slide>
  );
}
