import { Slide } from "@/components/deck/Slide";
import { AUTHORS } from "@/lib/deck";
import { stagger } from "@/lib/utils";

const FIGURES = [
  { value: "0", label: "payment processors in the middle" },
  { value: "₵0", label: "to send a friend money, everyday tier" },
  { value: "8", label: "deployables, live today" },
  { value: "1", label: "ledger under all of it" },
];

export function CoverSlide() {
  return (
    <Slide id="cover">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        Investor brief · September 2026 · Confidential
      </p>

      <h1 id="cover-title" className="display mt-7 anim" style={stagger(1)}>
        A closed-loop payments network with{" "}
        <span className="accent">no processor in the middle</span>.
      </h1>

      <p className="lede mt-6 anim" style={stagger(2)}>
        AZA moves money wallet-to-wallet on its own ledger — peer transfers, chat payments,
        merchant payments and money requests all settle instantly, internally. Cash reaches it
        through an agent network. No third party takes a cut of any transaction, which is why
        the everyday product can be free and still make money.
      </p>

      <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-5 anim" style={stagger(3)}>
        {[
          ["Built by", AUTHORS],
          ["Market", "Ghana · GHS · internal rails"],
          ["Status", "Live API, five portals, app in build"],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="eyebrow" style={{ gap: "0.5rem" }}>
              {term}
            </dt>
            <dd className="mt-2 text-[0.95rem] text-[var(--text)]">{value}</dd>
          </div>
        ))}
      </dl>

      <hr className="rule mt-12 anim anim-fade" style={stagger(4)} />

      <ul className="mt-7 flex flex-wrap gap-x-[clamp(2rem,6vw,5rem)] gap-y-6">
        {FIGURES.map((figure, i) => (
          <li key={figure.label} className="anim max-w-[16ch]" style={stagger(5 + i)}>
            <span className="mono block text-[clamp(1.7rem,3.4vw,2.6rem)] leading-none font-semibold tracking-tight">
              {figure.value}
            </span>
            <span className="body-sm mt-2 block">{figure.label}</span>
          </li>
        ))}
      </ul>
    </Slide>
  );
}
