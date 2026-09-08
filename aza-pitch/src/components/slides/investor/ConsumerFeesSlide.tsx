import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { FeeTable, type FeeRow } from "./FeeTable";
import { stagger } from "@/lib/utils";

const ROWS: FeeRow[] = [
  { name: "Cash-in — deposit at an agent", kind: "free", rate: "₵0 — always", why: "Zero friction on money entering. AZA pays the agent commission as an acquisition cost. Never charge this." },
  { name: "P2P transfer — everyday tier", kind: "free", rate: "₵0 up to ₵100, or ~₵1,000/month", why: "The headline brand promise: sending money to friends and family is free." },
  { name: "P2P transfer — above the free tier", kind: "fee", rate: "0.5%, capped at ₵10", why: "Large transfers are price-insensitive; the cap keeps it fair. Still cheaper than MoMo." },
  { name: "Paying a merchant", kind: "free", rate: "₵0 to the buyer — always", why: "The merchant pays MDR instead. Free consumer payments are what drive the digital ratio up." },
  { name: "Cash-out — withdrawal at an agent", kind: "fee", rate: "~1% tiered · ₵0.50 min · ₵15 cap", why: "Industry standard everywhere; users expect it. About half goes to the agent as commission." },
  { name: "Bill payments and airtime", kind: "free", rate: "₵0 to the consumer", why: "The biller or telco pays a collection commission. Feels free, earns money." },
  { name: "Standard e-statement", kind: "free", rate: "₵0", why: "Charging for your own data damages trust. Already built." },
  { name: "Official stamped statement", kind: "fee", rate: "₵10–20 per document", why: "Genuine admin work, rare, and universally expected to cost something." },
  { name: "AZA Plus — optional premium tier", kind: "fee", rate: "₵5–10/month, opt-in", why: "Higher limits, zero P2P fees at any size, priority support. Monetises power users without touching the free base." },
];

export function ConsumerFeesSlide() {
  return (
    <Slide id="fees-consumer" dense>
      <SlideHead
        id="fees-consumer"
        eyebrow="Fee catalogue · Consumer"
        title={
          <>
            Free where users <span className="accent">compare</span>. Charged where a fee is
            universally expected.
          </>
        }
        lede="The only consumer fee of any size is cash-out — which every competitor charges, so it cannot damage the brand, and which pays the human agent who handed over physical cash."
      />

      <div className="anim" style={stagger(3)}>
        <FeeTable rows={ROWS} />
      </div>

      <p className="body-sm mt-7 anim border-l-2 border-[var(--bad)] pl-4 max-w-[96ch]" style={stagger(4)}>
        <span className="text-[var(--text)] font-medium">Brand red lines — never charged.</span>{" "}
        Account opening, maintenance, minimum balance and dormancy. Receiving money of any kind.
        Checking a balance or viewing history. Credential replacement and in-app security.
        Customer support. These are precisely the fees banks charge, and the ones the brand is
        defined against.
      </p>
    </Slide>
  );
}
