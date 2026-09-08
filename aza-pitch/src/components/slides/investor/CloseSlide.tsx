import { Slide } from "@/components/deck/Slide";
import { AUTHORS } from "@/lib/deck";
import { stagger } from "@/lib/utils";

const OPEN_ITEMS = [
  ["BoG DEMI licence scope", "Including agent registration and per-agent reporting obligations. This determines the pilot’s legal shape and is the first conversation, not the last."],
  ["Float-interest pass-through", "The current Bank of Ghana rule on passing a portion of float interest to e-money holders. Until confirmed, only the net is budgeted."],
  ["Partner bank for the safeguarded account", "With a statement feed the reconciliation module can consume automatically — manual reconciliation does not scale past the pilot."],
];

export function CloseSlide() {
  return (
    <Slide id="close">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        Open items before launch
      </p>

      <h2 id="close-title" className="display mt-7 anim" style={stagger(1)}>
        The platform is built. The <span className="accent">licence</span> and the{" "}
        <span className="accent">float</span> are what is left.
      </h2>

      <ol className="mt-10 grid gap-x-12 gap-y-6 lg:grid-cols-3">
        {OPEN_ITEMS.map(([term, body], i) => (
          <li key={term} className="anim border-t border-[var(--accent)] pt-4" style={stagger(2 + i)}>
            <h3 className="text-[0.98rem] font-semibold tracking-[-0.01em]">{term}</h3>
            <p className="body-sm mt-2">{body}</p>
          </li>
        ))}
      </ol>

      <hr className="rule mt-12 anim anim-fade" style={stagger(5)} />

      <div className="mt-8 flex flex-wrap gap-x-14 gap-y-6">
        {[
          ["Built by", AUTHORS],
          ["Live API", "api.aza.systems"],
          ["Market", "Ghana · GHS · internal rails"],
          ["Document", "Internal strategy · v1.0"],
        ].map(([term, value], i) => (
          <div key={term} className="anim" style={stagger(6 + i)}>
            <p className="eyebrow" style={{ gap: "0.5rem" }}>
              {term}
            </p>
            <p className="mono mt-2 text-[0.92rem] text-[var(--text)]">{value}</p>
          </div>
        ))}
      </div>
    </Slide>
  );
}
