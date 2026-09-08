import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const MOVEMENT: Array<[string, string, string, string]> = [
  ["Hold unconditionally", "6", "8", "9"],
  ["Hold with a documented qualification", "2", "0", "0"],
  ["Vacuous — governed no live code", "1", "1", "0"],
];

const OBJECTIVES: Array<[string, string, "ok" | "warn"]> = [
  ["1 · Domain and data model", "Met", "ok"],
  ["2 · Transactional money engine", "Met", "ok"],
  ["3 · Message confidentiality", "Withdrawn, deliberately", "warn"],
  ["4 · Compliance and risk layer", "Met", "ok"],
  ["5 · Third-party platform surface", "Met", "ok"],
  ["6 · Delivery engineering", "Met", "ok"],
  ["7 · Evaluation", "Partially met", "warn"],
];

export function ResultsSlide() {
  return (
    <Slide id="results" dense>
      <SlideHead
        id="results"
        eyebrow="§12.1–12.3 · Results"
        title={
          <>
            Nine of nine — but the <span className="accent">movement</span> is the result, not
            the final column.
          </>
        }
      />

      <div className="grid gap-x-12 gap-y-9 lg:grid-cols-[1.1fr_0.9fr] items-start">
        <div className="anim" style={stagger(3)}>
          <h3 className="eyebrow">Invariant conformance over three states</h3>
          <div className="scroll-x">
            <table className="dtable mt-4 min-w-[420px]">
              <thead>
                <tr>
                  <th />
                  <th>Audit</th>
                  <th>After remediation</th>
                  <th>2026-09-06</th>
                </tr>
              </thead>
              <tbody>
                {MOVEMENT.map(([label, a, b, c]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="num">{a}</td>
                    <td className="num">{b}</td>
                    <td className="num accent font-semibold">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="body-sm mt-5">
            A table of nine green ticks demonstrates nothing about the method that produced it. A
            table showing two invariants that did not hold, a diagnosis for each, a fix, and a
            test that now enforces it is the evidence that the review gate does real work.
          </p>
          <p className="body-sm mt-3">
            They did not converge because the remaining work happened to satisfy them. They
            converged because each rule was used as a{" "}
            <span className="text-[var(--text)]">search query</span> against code the audit had
            never traced.
          </p>
        </div>

        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">Requirements traceability</h3>
          <ul className="mt-4 space-y-2.5">
            {OBJECTIVES.map(([name, status, tone]) => (
              <li
                key={name}
                className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-2.5"
              >
                <span className="text-[0.9rem]">{name}</span>
                <span className={`pill pill--${tone}`}>{status}</span>
              </li>
            ))}
          </ul>
          <p className="body-sm mt-5">
            Two verification passes produced ten findings. Nine are fixed and covered by tests;
            the tenth is the E2EE withdrawal, which is a trade rather than a defect and is argued
            as one.
          </p>
        </div>
      </div>
    </Slide>
  );
}
