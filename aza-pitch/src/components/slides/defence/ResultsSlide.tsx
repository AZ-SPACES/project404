import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const OBJECTIVES: Array<[string, string, "ok" | "warn"]> = [
  ["1 · Domain and data model", "Met", "ok"],
  ["2 · Transactional money engine", "Met", "ok"],
  ["3 · Message confidentiality", "Withdrawn, deliberately", "warn"],
  ["4 · Compliance and risk layer", "Met", "ok"],
  ["5 · Third-party platform surface", "Met", "ok"],
  ["6 · Delivery engineering", "Met", "ok"],
  ["7 · Evaluation", "Partially met", "warn"],
];

const MOVEMENT: Array<[string, string, string]> = [
  ["Hold unconditionally", "6", "9"],
  ["Hold with a qualification", "2", "0"],
  ["Vacuous — governed no live code", "1", "0"],
];

const HANDOFFS: Array<[string, string]> = [
  ["Performance under sustained load", "The concurrency work is a correctness experiment and is not a substitute for a throughput benchmark."],
  ["Usability evaluation", "No study has been run. Nothing in this deck asserts a usability result."],
  ["Comparative evaluation", "Feature-by-feature against named competitors, independently verified before publication."],
];

export function ResultsSlide() {
  return (
    <Slide id="results" dense>
      <SlideHead
        id="results"
        eyebrow="§12–13 · Results and limitations"
        title={
          <>
            Nine of nine — but the <span className="accent">movement</span> is the result, not
            the final column.
          </>
        }
      />

      <div className="grid gap-x-[clamp(1.5rem,3.5vw,3rem)] gap-y-8 lg:grid-cols-3 items-start">
        <div className="anim" style={stagger(3)}>
          <h3 className="eyebrow">Invariant conformance</h3>
          <table className="dtable mt-4">
            <thead>
              <tr>
                <th />
                <th>Audit</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {MOVEMENT.map(([label, before, after]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{before}</td>
                  <td className="num accent font-semibold">{after}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="body-sm mt-4">
            Nine green ticks demonstrate nothing about the method that produced them. Two red
            cells, a diagnosis for each, and a test that now enforces the fix are the evidence
            that the review gate does real work.
          </p>
        </div>

        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">Objectives traceability</h3>
          <ul className="mt-4 space-y-2">
            {OBJECTIVES.map(([name, status, tone]) => (
              <li
                key={name}
                className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2"
              >
                <span className="text-[0.85rem]">{name}</span>
                <span className={`pill pill--${tone}`}>{status}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="anim" style={stagger(5)}>
          <h3 className="eyebrow">Not gaps — handoffs</h3>
          <ul className="mt-4 space-y-3.5">
            {HANDOFFS.map(([term, body]) => (
              <li key={term}>
                <p className="text-[0.9rem] font-medium">
                  {term} <span className="pill pill--warn ml-1.5 align-middle">To run</span>
                </p>
                <p className="body-sm mt-1.5">{body}</p>
              </li>
            ))}
          </ul>
          <p className="body-sm mt-4 border-l-2 border-[var(--accent)] pl-4">
            These need measurement or an external decision, not further engineering. An unmeasured
            claim presented as a result is the one failure mode a viva is guaranteed to find.
          </p>
        </div>
      </div>
    </Slide>
  );
}
