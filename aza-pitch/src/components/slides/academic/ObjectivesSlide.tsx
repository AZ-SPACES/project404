import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const OBJECTIVES = [
  ["01", "Domain and data model", "Consumer, merchant, agent-float and platform balances without violating the safeguarding invariant."],
  ["02", "Transactional money engine", "Balanced movement, idempotency, concurrency-safe balance updates, complete audit trail."],
  ["03", "Message confidentiality", "Build strong confidentiality — and evaluate the trade between end-to-end encryption and account-owned history."],
  ["04", "Compliance and risk layer", "Tiered KYC, limits, velocity and structuring monitoring, sanctions screening, maker–checker, regulatory reporting."],
  ["05", "Third-party platform surface", "Merchant APIs, hosted checkout, marketplace splits, OAuth 2.0 + PKCE identity, mandates, sandboxed mini-apps."],
  ["06", "Delivery engineering", "Schema migrations, containerised deployment, zero-downtime rollout, automated CI, operational tooling."],
  ["07", "Evaluation", "Functional completeness, security properties, performance under concurrency, conformance to the stated invariants."],
];

export function ObjectivesSlide() {
  return (
    <Slide id="objectives">
      <SlideHead
        id="objectives"
        eyebrow="§1.3–1.4 · Aim and objectives"
        title={
          <>
            One ledger, with <span className="accent">enforceable</span> financial, security
            and regulatory invariants.
          </>
        }
        lede="To design, implement and evaluate an integrated, mobile-first platform that unifies encrypted messaging, peer-to-peer e-money transfer, merchant acceptance, an agent cash network and a third-party developer platform."
      />

      <ol className="grid gap-x-10 gap-y-5 md:grid-cols-2">
        {OBJECTIVES.map(([n, title, body], i) => (
          <li
            key={n}
            className="flex gap-4 anim border-t border-[var(--line)] pt-4"
            style={stagger(3 + i)}
          >
            <span className="mono text-[0.72rem] tracking-[0.16em] text-[var(--text-tertiary)] pt-1">
              {n}
            </span>
            <div>
              <h3 className="text-[0.98rem] font-semibold tracking-[-0.01em]">
                {title}
                {n === "03" ? (
                  <span className="pill pill--warn ml-2.5 align-middle">Revised</span>
                ) : null}
              </h3>
              <p className="body-sm mt-1.5">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="body-sm mt-7 anim max-w-[78ch]" style={stagger(11)}>
        <span className="accent">Objective 3 is reported in revised form.</span> It was met —
        X3DH with per-device identities was built, tested and deployed — and then deliberately
        withdrawn for new messages. Restating the original objective and claiming it met would
        be false. The trade is the result, and it is argued in full at §12.4a.
      </p>
    </Slide>
  );
}
