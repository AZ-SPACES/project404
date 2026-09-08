import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { FeeTable, type FeeRow } from "./FeeTable";
import { stagger } from "@/lib/utils";

const ROWS: FeeRow[] = [
  { name: "Merchant discount rate on payments received", kind: "b2b", rate: "0.75–1.5% by volume tier", why: "Core merchant revenue. Cheaper than card rails, and merchants get instant settlement. Small and informal sellers pay 0.5%, or nothing below ₵2,000/month — the free micro-tier is what seeds adoption among market traders." },
  { name: "Payment links and invoicing", kind: "b2b", rate: "Same MDR, no extra link fee", why: "Already built in the merchant portal; MDR covers it." },
  { name: "Merchant API transactions", kind: "b2b", rate: "MDR + optional per-call above a generous free quota", why: "Monetises high-volume integrations using the API-key infrastructure that already exists." },
  { name: "Instant payout to a bank", kind: "b2b", rate: "₵2–10 flat · free if kept in the AZA wallet", why: "A pricing nudge: keeping settlement balances inside AZA grows float, which is itself a revenue line." },
  { name: "Bulk disbursements — payroll, refunds, aid", kind: "b2b", rate: "₵0.50–1.00 per recipient", why: "Businesses pay for the convenience; recipients receive free." },
  { name: "Chargeback and dispute handling", kind: "b2b", rate: "₵20 per upheld dispute", why: "Covers operational cost and disciplines bad actors." },
];

export function MerchantFeesSlide() {
  return (
    <Slide id="fees-merchant" dense>
      <SlideHead
        id="fees-merchant"
        eyebrow="Fee catalogue · Merchant"
        title={
          <>
            The long-term <span className="accent">profit engine</span>.
          </>
        }
        lede="Consumers are the distribution; merchants are the margin. Every one of these lines is invisible to the person paying, which is what lets the consumer product stay free without the business being charitable."
      />

      <div className="anim" style={stagger(3)}>
        <FeeTable rows={ROWS} />
      </div>

      <p className="body-sm mt-7 anim border-l-2 border-[var(--accent)] pl-4 max-w-[96ch]" style={stagger(4)}>
        The merchant portal, the hosted checkout, the marketplace splits, the webhooks and the
        API-key system are <span className="text-[var(--text)]">already built and tested</span>.
        Switching MDR on is a fee-schedule change under maker–checker, not a development project.
      </p>
    </Slide>
  );
}
