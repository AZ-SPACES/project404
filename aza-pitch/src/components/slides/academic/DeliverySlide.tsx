import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const GATES: Array<[string, string, string]> = [
  [
    "Money-path review",
    "Any diff touching wallets, transfers, payouts, withdrawals, agent float, checkout or Connect",
    "Ends in an explicit Block or Approve. Approve requires every one of the nine invariants explicitly verified — “nothing jumped out” is not approval.",
  ],
  [
    "Deploy preflight",
    "Before any production deploy",
    "A PASS/FAIL table over pending migrations, required env vars, images and rollout readiness.",
  ],
  [
    "App-store audit",
    "Before a store submission",
    "140+ rules across 32 categories: privacy, permissions, security, UI/UX, metadata, billing.",
  ],
];

export function DeliverySlide() {
  return (
    <Slide id="delivery">
      <SlideHead
        id="delivery"
        eyebrow="§10 · Delivery engineering and operations"
        title={
          <>
            Gates that <span className="accent">actually run</span>, and the cost of the one
            that was missing.
          </>
        }
        lede="GitHub Actions across four jobs and, at the verification commit, eight job instances; gated CD, Flyway with baselining over 62 migrations, automated TLS, and nine schedulers."
      />

      <div className="grid gap-x-12 gap-y-9 lg:grid-cols-[1.05fr_0.95fr] items-start">
        <div>
          <h3 className="eyebrow anim" style={stagger(3)}>
            Three review gates
          </h3>
          <ul className="mt-5 space-y-5">
            {GATES.map(([name, trigger, output], i) => (
              <li key={name} className="anim border-t border-[var(--line)] pt-4" style={stagger(4 + i)}>
                <h4 className="text-[0.95rem] font-semibold">{name}</h4>
                <p className="mono mt-1.5 text-[0.74rem] text-[var(--text-tertiary)]">{trigger}</p>
                <p className="body-sm mt-2">{output}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="card anim border-[var(--accent)]" style={stagger(7)}>
            <h3 className="eyebrow">The missing gate, quantified</h3>
            <p className="body-sm mt-3">
              With no CI job running it, the mobile typecheck had drifted to{" "}
              <span className="mono accent">893 errors</span> — and buried in the noise were two
              live defects shipping to users: eighteen overlays silently stripped of their
              positioning by a React Native API that no longer exists, and a Copy button that
              threw on every press.
            </p>
            <p className="body-sm mt-3">
              Neither is reachable by a unit test — nothing asserts on style objects — and Metro
              strips types without checking them, so the build stayed green throughout. That is a
              concrete answer to whether the missing job was costing anything, and a better
              argument for static analysis than any appeal to best practice.
            </p>
          </div>

          <p className="body-sm anim border-l-2 border-[var(--warn)] pl-4" style={stagger(8)}>
            <span className="text-[var(--text)] font-medium">The counterweight.</span> A schema
            assertion added to enforce invariant 5 over-matched, flagging boolean columns as
            non-exact money columns and failing CI on a correct migration. A gate that is wrong
            is a gate that gets disabled — so the cost of a false positive in a blocking check is
            higher than its nuisance value suggests.
          </p>
        </div>
      </div>
    </Slide>
  );
}
