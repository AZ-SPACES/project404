import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

export function SafeguardingSlide() {
  return (
    <Slide id="safeguarding">
      <SlideHead
        id="safeguarding"
        eyebrow="Safeguarding"
        title={
          <>
            E-money is only created against{" "}
            <span className="accent">verified bank money</span>.
          </>
        }
      />

      <div
        className="anim rounded-[var(--radius)] border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] px-[clamp(1.2rem,3vw,2.4rem)] py-[clamp(1.4rem,3vh,2.2rem)]"
        style={stagger(3)}
      >
        <p className="eyebrow">The safeguarding invariant</p>
        <p
          className="mono mt-4 font-semibold tracking-tight"
          style={{ fontSize: "clamp(1rem, 2.5vw, 1.9rem)", lineHeight: 1.25 }}
        >
          Total e-money issued <span className="accent">=</span> balance of the safeguarded bank
          account
        </p>
      </div>

      <div className="mt-9 grid gap-x-12 gap-y-8 lg:grid-cols-3 items-start">
        {[
          [
            "Minting",
            "New e-money is created only when an agent or super-agent deposits real money into the safeguarded account at a partner bank, verified by back office under maker–checker. A FloatMovement row is written for every mint, with a uniqueness constraint on the bank reference so the same deposit cannot be counted twice.",
          ],
          [
            "Burning",
            "The reverse: e-money is destroyed and bank money is wired out, under the same dual control and the same ledger discipline.",
          ],
          [
            "Continuous reconciliation",
            "The reconciliation module compares the ledger against the aggregate and raises a ReconBreak when they disagree, with SafeguardingSnapshot rows giving a point-in-time position. A discrepancy surfaces as an operational item rather than ageing silently.",
          ],
        ].map(([term, body], i) => (
          <div key={term} className="anim" style={stagger(4 + i)}>
            <h3 className="eyebrow">{term}</h3>
            <p className="body-sm mt-3">{body}</p>
          </div>
        ))}
      </div>

      <p className="body-sm mt-9 anim border-l-2 border-[var(--accent)] pl-4 max-w-[96ch]" style={stagger(7)}>
        <span className="text-[var(--text)] font-medium">
          The agent network does not disturb this.
        </span>{" "}
        Cash-in and cash-out move value between two wallets that already exist on the ledger, so
        neither mints nor burns anything and the total in issue is unchanged. Only the bank leg
        changes the total, and only back office can authorise it.
      </p>
    </Slide>
  );
}
