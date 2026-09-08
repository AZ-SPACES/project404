import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

export function AuditSlide() {
  return (
    <Slide id="audit">
      <SlideHead
        id="audit"
        eyebrow="Audit and reconciliation"
        title={
          <>
            A daily hash chain that makes tampering{" "}
            <span className="accent">detectable</span>.
          </>
        }
        lede="Every staff action is recorded. On top of that record, each day’s entries are anchored: a SHA-256 is taken over the previous anchor’s hash concatenated with a canonical rendering of that day’s entries, and stored with the day’s entry count. The first anchor chains to the literal string GENESIS."
      />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2 items-start">
        <div className="anim" style={stagger(3)}>
          <h3 className="eyebrow">What the chain gives you</h3>
          <p className="body-sm mt-3">
            Deleting or editing a historical audit row changes that day’s content hash, and
            therefore breaks every anchor from that day forward. A verification endpoint walks the
            chain and reports the first break, so the question “has this log been altered?” has a
            mechanical answer rather than a procedural one.
          </p>
          <p className="body-sm mt-3">
            Separately, every value movement writes its ledger record inside the same transaction
            that moved the value — so the audit trail cannot be missing an entry for a transfer
            that committed.
          </p>
        </div>

        <div className="anim border-l-2 border-[var(--warn)] pl-5" style={stagger(4)}>
          <h3 className="eyebrow">Being precise about the claim</h3>
          <p className="body-sm mt-3">
            This makes tampering <span className="text-[var(--text)]">detectable, not
            impossible</span>. An attacker with write access to the anchor table can recompute the
            whole chain. Genuine immutability requires the anchors to be published off-box — to
            append-only storage, a notary, or a public chain.
          </p>
          <p className="body-sm mt-3">
            That is a known limitation with a known remedy, and it is stated here rather than left
            for an examiner to find.
          </p>
        </div>
      </div>

      <div
        className="anim mt-9 rounded-[var(--radius)] border border-[var(--line-strong)] px-[clamp(1.2rem,3vw,2rem)] py-[clamp(1.1rem,2.5vh,1.7rem)]"
        style={stagger(5)}
      >
        <p className="eyebrow">Reconciliation</p>
        <p className="body-sm mt-3 max-w-[96ch]">
          The reconciliation module compares the ledger against the aggregate position and writes a
          break record when they disagree, with point-in-time safeguarding snapshots for the
          regulatory position. Because the authoritative balance is a materialised column rather
          than a derived sum, reconciliation is not optional bookkeeping — it is the mechanism that
          makes the materialisation safe, and it is treated as such.
        </p>
      </div>
    </Slide>
  );
}
