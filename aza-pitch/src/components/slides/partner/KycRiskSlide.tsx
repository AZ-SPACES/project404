import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const TIERS: Array<[string, string, string, string, string]> = [
  ["Tier 1", "1,000", "2,000", "6,000", "5,000"],
  ["Tier 2", "5,000", "10,000", "30,000", "20,000"],
  ["Tier 3", "25,000", "50,000", "200,000", "none"],
];

const RULES = [
  ["Large transfer", "A value threshold check on every completed transfer."],
  ["Velocity", "Count and value within a rolling window."],
  ["Structuring", "The smurfing heuristic: three or more transfers in 24 hours, each in the 70–100% band of the large-transfer threshold."],
  ["Anomaly scoring", "Written back to the transaction; a high score at confirmation moves it to HELD_FOR_REVIEW rather than completing."],
];

export function KycRiskSlide() {
  return (
    <Slide id="kyc-risk" dense>
      <SlideHead
        id="kyc-risk"
        eyebrow="KYC and transaction monitoring"
        title={
          <>
            Tiered limits at <span className="accent">one enforcement point</span>, monitoring on
            every transfer.
          </>
        }
      />

      <div className="grid gap-x-14 gap-y-9 lg:grid-cols-2 items-start">
        <div className="anim" style={stagger(3)}>
          <h3 className="eyebrow">Tiered e-money limits (GHS)</h3>
          <div className="scroll-x">
            <table className="dtable mt-4 min-w-[420px]">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Single</th>
                  <th>Daily</th>
                  <th>Monthly</th>
                  <th>Wallet ceiling</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map(([tier, single, daily, monthly, ceiling]) => (
                  <tr key={tier}>
                    <td className="font-medium">{tier}</td>
                    <td className="num">{single}</td>
                    <td className="num">{daily}</td>
                    <td className="num">{monthly}</td>
                    <td className="num">{ceiling}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="body-sm mt-4">
            A single guard is the enforcement point for all of them, so every money path — consumer
            transfer, merchant payment, agent cash, recurring transfer — applies identical caps
            rather than each re-implementing them.
          </p>
          <p className="body-sm mt-3 border-l-2 border-[var(--warn)] pl-4">
            <span className="text-[var(--text)] font-medium">These figures are placeholders</span>{" "}
            to be confirmed against current Bank of Ghana directives. The mechanism is the claim;
            the numbers are an input.
          </p>
        </div>

        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">Monitoring on every completed transfer</h3>
          <ul className="mt-4 space-y-4">
            {RULES.map(([term, body]) => (
              <li key={term} className="border-t border-[var(--line)] pt-3">
                <p className="text-[0.93rem] font-medium">{term}</p>
                <p className="body-sm mt-1.5">{body}</p>
              </li>
            ))}
          </ul>
          <p className="body-sm mt-5">
            Thresholds are held as data and tunable live by COMPLIANCE without a deploy. Every
            evaluation writes a decision log, so a compliance position is reconstructable after the
            fact. Sanctions screening runs against a maintained list, producing match records for
            review.
          </p>
          <p className="body-sm mt-3 border-l-2 border-[var(--line-strong)] pl-4">
            <span className="text-[var(--text)] font-medium">A deliberate trade:</span> risk
            evaluation can never fail a transfer — a monitoring bug must not become a payments
            outage. Its cost is that a silent evaluation failure leaves a transaction unscored,
            which is exactly why the decision log exists.
          </p>
        </div>
      </div>
    </Slide>
  );
}
