import { Slide } from "@/components/deck/Slide";
import { AUTHORS } from "@/lib/deck";
import { stagger } from "@/lib/utils";

const FIGURES = [
  { value: "253k", label: "lines of code" },
  { value: "8", label: "deployables" },
  { value: "835", label: "tests passing" },
  { value: "9 / 9", label: "money invariants" },
];

export function CoverSlide() {
  return (
    <Slide id="cover">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        Thesis defence · September 2026
      </p>

      <h1 id="cover-title" className="display mt-7 anim" style={stagger(1)}>
        Encrypted messaging and regulated{" "}
        <span className="accent">e&#8209;money settlement</span> inside one
        transactional boundary.
      </h1>

      <p className="lede mt-6 anim" style={stagger(2)}>
        Design, implementation and evaluation of <strong className="text-[var(--text)] font-semibold">AZA</strong> — a
        mobile-first digital financial services platform for Ghana, built as a single ledger
        carrying a wallet, a chat, a merchant rail, an agent cash network and a developer platform.
      </p>

      <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-5 anim" style={stagger(3)}>
        {[
          ["Candidates", AUTHORS],
          ["Institution", "KNUST"],
          ["Artefact verified at", "9678fa5a · 2026-09-06"],
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
          <li key={figure.label} className="anim" style={stagger(5 + i)}>
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
