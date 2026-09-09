import { Slide } from "@/components/deck/Slide";
import { AUTHORS } from "@/lib/deck";
import { stagger } from "@/lib/utils";

export function CloseSlide() {
  return (
    <Slide id="close">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        In closing
      </p>

      <h2 id="close-title" className="display mt-7 anim" style={stagger(1)}>
        An invariant understood by its authors is not the same as an invariant that is{" "}
        <span className="accent">enforced</span>.
      </h2>

      <p className="lede mt-6 anim" style={stagger(2)}>
        The gap between the two is what a mechanical gate closes, and it is invisible without
        one. That is the argument this system was built to make — and the evidence for it is the
        table with two red cells in it, not the one with nine green.
      </p>

      <hr className="rule mt-11 anim anim-fade" style={stagger(3)} />

      <div className="mt-8 flex flex-wrap gap-x-14 gap-y-6">
        {[
          ["Artefact", "github.com/az-spaces"],
          ["Live API", "api.aza.systems"],
          ["Verified at", "9678fa5a · 2026-09-06"],
          ["Candidates", AUTHORS],
          ["Institution", "KNUST"],
        ].map(([term, value], i) => (
          <div key={term} className="anim" style={stagger(4 + i)}>
            <p className="eyebrow" style={{ gap: "0.5rem" }}>
              {term}
            </p>
            <p className="mono mt-2 text-[0.92rem] text-[var(--text)]">{value}</p>
          </div>
        ))}
      </div>

      <p className="body-sm mt-12 anim" style={stagger(9)}>
        Thank you. Questions welcome &mdash; including the licensing one.
      </p>
    </Slide>
  );
}
