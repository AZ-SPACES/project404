import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const ARCHITECTURAL = [
  "Single-instance real-time delivery. The Redis fan-out path exists and is a configuration flip, but has not been exercised in production.",
  "Nine schedulers run in-process, and would double-execute on a second instance without leader election.",
  "One PostgreSQL instance, no read replicas.",
  "Materialised balances rather than a derived double-entry ledger — the authoritative balance is a column, not a sum, which is why reconciliation exists at all.",
  "The agent hierarchy is one level deep and write-once. Re-parenting will need cycle detection over the whole chain.",
];

const REGULATORY = [
  "GHS only, Ghana only, internal rails. No FX, no GhIPSS or MNO interconnection, no card acquiring.",
  "KYC tier limits are placeholders — the enum says so in its own Javadoc — and must be reconciled against current Bank of Ghana directives.",
  "Not a licensed institution. The controls are modelled on regulatory expectations; the system has not been through supervisory approval.",
  "Sanctions screening is list-matching, with no fuzzy-matching quality metrics reported.",
];

const HANDOFFS = [
  ["Performance evaluation", "Throughput and latency under sustained load. The concurrency work is a correctness experiment and is not a substitute."],
  ["Comparative evaluation", "Feature-by-feature against named competitors, with every claim independently verified before publication."],
  ["Usability evaluation", "No study has been run. Nothing in this deck asserts a usability result."],
];

export function LimitationsSlide() {
  return (
    <Slide id="limitations" dense>
      <SlideHead
        id="limitations"
        eyebrow="§13 · Limitations and future work"
        title={
          <>
            Every one of these is defensible. <span className="accent">None is fatal.</span>
          </>
        }
        lede="Stated here rather than conceded under questioning — and separated into what is a limitation of the artefact and what is simply not yet measured."
      />

      <div className="grid gap-x-11 gap-y-8 lg:grid-cols-3 items-start">
        <div className="anim" style={stagger(3)}>
          <h3 className="eyebrow">Architectural</h3>
          <ul className="mt-4 space-y-2.5">
            {ARCHITECTURAL.map((item) => (
              <li key={item} className="body-sm flex gap-2.5">
                <span aria-hidden="true" className="dim mono pt-px">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">Financial and regulatory</h3>
          <ul className="mt-4 space-y-2.5">
            {REGULATORY.map((item) => (
              <li key={item} className="body-sm flex gap-2.5">
                <span aria-hidden="true" className="dim mono pt-px">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="anim" style={stagger(5)}>
          <h3 className="eyebrow">Not gaps in the research — handoffs</h3>
          <ul className="mt-4 space-y-4">
            {HANDOFFS.map(([term, body]) => (
              <li key={term}>
                <p className="text-[0.9rem] font-medium">
                  {term} <span className="pill pill--warn ml-1.5 align-middle">To run</span>
                </p>
                <p className="body-sm mt-1.5">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="body-sm mt-8 anim border-l-2 border-[var(--accent)] pl-4 max-w-[90ch]" style={stagger(6)}>
        These require measurement or an external decision, not further engineering. They are
        marked as outstanding in the written thesis for the same reason they are marked here:
        an unmeasured claim presented as a result is the one failure mode a viva is guaranteed
        to find.
      </p>
    </Slide>
  );
}
