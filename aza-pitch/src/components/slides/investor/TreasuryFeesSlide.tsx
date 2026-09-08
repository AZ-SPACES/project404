import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { FeeTable, type FeeRow } from "./FeeTable";
import { stagger } from "@/lib/utils";

const ROWS: FeeRow[] = [
  { name: "Float interest on the safeguarded account", kind: "b2b", rate: "Market deposit / T-bill rate on total float", why: "Material at Ghanaian interest rates. Caveat: BoG e-money rules require a portion of float interest to be passed to e-money holders, so only the net is ever budgeted." },
  { name: "Biller collection commissions", kind: "b2b", rate: "1–3% from utilities, schools, insurers", why: "Billers pay for cheap, reconciled collections. This is what funds “free” bill pay." },
  { name: "Telco airtime commissions", kind: "b2b", rate: "2–5% standard channel margin", why: "Funds “free” top-ups on exactly the same pattern." },
  { name: "Mini-app platform revenue share", kind: "b2b", rate: "10–20% of mini-app transaction fees", why: "Monetises the mini-app platform that is already running, as third-party apps grow." },
  { name: "Micro-credit — phase 3, with a partner licence", kind: "b2b", rate: "Facilitation fee ~3–7% per loan cycle", why: "Wallet and agent history is ideal credit-scoring data. A separate licensing conversation — deliberately not built yet." },
  { name: "FX margin on cross-border", kind: "b2b", rate: "0.5–1.5% spread", why: "Future only, and only if remittance corridors open. Out of scope for v1." },
];

export function TreasuryFeesSlide() {
  return (
    <Slide id="fees-treasury" dense>
      <SlideHead
        id="fees-treasury"
        eyebrow="Fee catalogue · Partner and treasury"
        title={
          <>
            Revenue that is <span className="accent">invisible to everyone</span> — including
            the merchant.
          </>
        }
        lede="These lines fund the parts of the product that feel free. A user who pays no fee to top up airtime is being subsidised by the telco’s channel commission, and that is a stable arrangement rather than a loss leader."
      />

      <div className="anim" style={stagger(3)}>
        <FeeTable rows={ROWS} whatLabel="Revenue line" />
      </div>

      <p className="body-sm mt-7 anim border-l-2 border-[var(--warn)] pl-4 max-w-[96ch]" style={stagger(4)}>
        Float interest is the line most likely to be over-modelled by an outside reader. The
        pass-through requirement to e-money holders is a live regulatory question and is listed on
        the open-items slide — <span className="text-[var(--text)]">only the net is counted</span>,
        and the current rule has to be confirmed before it is counted at all.
      </p>
    </Slide>
  );
}
