import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

export function SafeguardingSlide() {
  return (
    <Slide id="safeguarding">
      <SlideHead
        id="safeguarding"
        eyebrow="Where real money enters"
        title={
          <>
            Agents cannot <span className="accent">conjure float</span>.
          </>
        }
        lede="New e-money is only ever created when an agent or super-agent deposits real money into AZA’s safeguarded float account at a partner bank, verified by back office under maker–checker. Float withdrawal is the reverse: e-money is burned, bank money is wired out."
      />

      <div
        className="anim rounded-[var(--radius)] border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] px-[clamp(1.2rem,3vw,2.4rem)] py-[clamp(1.4rem,3vh,2.2rem)]"
        style={stagger(3)}
      >
        <p className="eyebrow">The safeguarding invariant</p>
        <p
          className="mono mt-4 font-semibold tracking-tight"
          style={{ fontSize: "clamp(1.05rem, 2.6vw, 2rem)", lineHeight: 1.25 }}
        >
          Total e-money issued <span className="accent">=</span> balance of the safeguarded bank
          account
        </p>
        <p className="body-sm mt-4">
          Enforced continuously by the reconciliation module, which raises a break rather than
          letting a discrepancy age quietly. It is the property that makes every other number in
          this deck checkable by someone who does not trust us.
        </p>
      </div>

      <div className="mt-9 grid gap-x-12 gap-y-7 lg:grid-cols-2 items-start">
        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">Why it holds through the agent network</h3>
          <p className="body-sm mt-3">
            Because cash-in and cash-out move value between two wallets that both already exist on
            the ledger, neither mints nor burns anything. The agent’s float and the user’s balance
            are two sides of one internal transfer, and the total is unchanged. Only the bank leg
            changes the total, and only back office can authorise it.
          </p>
        </div>

        <div className="anim border-l-2 border-[var(--warn)] pl-5" style={stagger(5)}>
          <h3 className="eyebrow">Regulatory note, stated up front</h3>
          <p className="body-sm mt-3">
            Operating an agent network for e-money in Ghana places AZA in{" "}
            <span className="text-[var(--text)]">Dedicated Electronic Money Issuer</span> territory
            under the Payment Systems and Services Act, 2019 (Act 987). Agent registration, agent
            due diligence and per-agent reporting to the Bank of Ghana are licence requirements.
            AZA is not currently a licensed issuer — this is on the open-items slide, not buried.
          </p>
        </div>
      </div>
    </Slide>
  );
}
