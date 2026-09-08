import { Slide } from "@/components/deck/Slide";
import { stagger } from "@/lib/utils";

export function GapSlide() {
  return (
    <Slide id="gap">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        §1.2 · Statement of the problem
      </p>

      <blockquote className="mt-8 anim" style={stagger(1)}>
        <p
          className="font-medium tracking-[-0.03em]"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 3rem)", lineHeight: 1.14 }}
          id="gap-title"
        >
          No widely available platform in the market offers{" "}
          <span className="accent">private conversation</span> and{" "}
          <span className="accent">regulated e&#8209;money settlement</span> within a single,
          auditable transactional boundary.
        </p>
      </blockquote>

      <hr className="rule mt-12 anim anim-fade" style={stagger(2)} />

      <div className="mt-8 grid gap-8 md:grid-cols-3">
        {[
          ["Consequence for consumers", "Poor everyday peer-to-peer settlement, and audit trails that are weak and non-verifiable."],
          ["Consequence for merchants", "High integration cost, because messaging, payment and acceptance are separate, loosely-coupled products."],
          ["The design response", "One wallet where chat, payment, merchant acceptance, the agent cash network and the developer platform are one system on one ledger."],
        ].map(([term, body], i) => (
          <div key={term} className="anim" style={stagger(3 + i)}>
            <h3 className="eyebrow">{term}</h3>
            <p className="body-sm mt-3">{body}</p>
          </div>
        ))}
      </div>
    </Slide>
  );
}
