import { Slide } from "@/components/deck/Slide";
import { OneLedgerFigure } from "@/components/slides/defence/Diagrams";
import { stagger } from "@/lib/utils";

/* The scope statement, compressed to what has to be *said* rather than read.
   The full delimitations table is on the academic track at §1.5. */
const IN = ["Ghana · GHS only", "Internal rails between AZA wallets", "iOS · Android · watchOS", "API key and OAuth 2.0 integration"];
const OUT = ["Multi-currency and FX", "MNO / GhIPSS interconnection", "Card acquiring and issuing", "A regulatory licence"];

export function ResponseSlide() {
  return (
    <Slide id="response">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        §1.2 · Statement of the problem
      </p>

      <blockquote className="mt-6 anim" style={stagger(1)}>
        <p
          id="response-title"
          className="font-medium tracking-[-0.03em] max-w-[26ch] md:max-w-none"
          style={{ fontSize: "clamp(1.4rem, 3.1vw, 2.6rem)", lineHeight: 1.14 }}
        >
          No available platform offers <span className="accent">private conversation</span> and{" "}
          <span className="accent">regulated settlement</span> inside one auditable transactional
          boundary.
        </p>
      </blockquote>

      <div className="mt-[clamp(1.1rem,2.4vh,2rem)] anim" style={stagger(2)}>
        <OneLedgerFigure />
      </div>

      <div className="mt-[clamp(1.1rem,2.4vh,1.8rem)] grid gap-x-12 gap-y-5 md:grid-cols-2">
        <div className="anim" style={stagger(3)}>
          <h3 className="eyebrow">In scope — built</h3>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {IN.map((item) => (
              <li key={item} className="body-sm flex gap-2">
                <span aria-hidden="true" className="accent mono">
                  +
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">Deliberately out of scope</h3>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {OUT.map((item) => (
              <li key={item} className="body-sm flex gap-2">
                <span aria-hidden="true" className="mono" style={{ color: "var(--bad)" }}>
                  &minus;
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Slide>
  );
}
