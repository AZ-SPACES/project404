import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

export function InvariantFourSlide() {
  return (
    <Slide id="invariant-four">
      <SlideHead
        id="invariant-four"
        eyebrow="§5.4a · The most useful finding in the thesis"
        title={
          <>
            Invariant 4 was verified as holding. It was{" "}
            <span className="accent">held only by convention</span>.
          </>
        }
      />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-3 items-start">
        <div className="anim" style={stagger(3)}>
          <span className="pill pill--warn">August — verified</span>
          <p className="body-sm mt-4">
            Concurrency safety was confirmed by tracing every documented money path. Every path
            traced did take its row lock. The verdict was correct about everything it looked at.
          </p>
        </div>

        <div className="anim" style={stagger(4)}>
          <span className="pill pill--bad">September — searched</span>
          <p className="body-sm mt-4">
            The same rule used as a <span className="text-[var(--text)]">search query</span>{" "}
            instead of a checklist found three wallet writers that took no lock at all — promo
            credit, referral reward, and float mint/burn. None was on a documented path, so no
            amount of tracing would ever have reached them.
          </p>
        </div>

        <div className="anim" style={stagger(5)}>
          <span className="pill pill--ok">The structural fix</span>
          <p className="body-sm mt-4">
            <span className="mono accent">WalletLedger</span> takes the lock at the entry point,
            so no caller can omit it. Fourteen tests hold it there. The property moved from
            &ldquo;we checked and it was fine&rdquo; to &ldquo;there is no way to write this
            wrong&rdquo;.
          </p>
        </div>
      </div>

      <hr className="rule my-10 anim anim-fade" style={stagger(6)} />

      <blockquote className="anim" style={stagger(7)}>
        <p
          className="font-medium tracking-[-0.025em] max-w-[26ch] sm:max-w-none"
          style={{ fontSize: "clamp(1.25rem, 2.7vw, 2.15rem)", lineHeight: 1.2 }}
        >
          An invariant that is enforced by every author remembering it is not a verified
          property. It is an <span className="accent">unfalsified</span> one.
        </p>
      </blockquote>

      <p className="body-sm mt-7 anim max-w-[86ch]" style={stagger(8)}>
        Generalised: a chokepoint that owns the dangerous operation eliminates a{" "}
        <span className="text-[var(--text)]">defect class</span>, while an audit that finds every
        instance of it eliminates a <span className="text-[var(--text)]">defect list</span>. That
        difference is the difference between an audit result and a design property — and it is
        measurable, because the audit had already declared this invariant green.
      </p>
    </Slide>
  );
}
