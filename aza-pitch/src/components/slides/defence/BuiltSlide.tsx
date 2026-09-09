import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const METRICS = [
  { value: "253k", label: "lines across 8 deployables", sub: "750+ commits, Mar–Sep 2026" },
  { value: "62", label: "schema migrations", sub: "V1 → V64, applied in CI" },
  { value: "171", label: "mobile screens", sub: "React Native · Expo · watchOS" },
  { value: "835", label: "tests, 0 failures", sub: "509 backend · 326 mobile · 20 E2E" },
];

/* Named surfaces rather than the full eight-row deployable table — the table is
   readable, but it is not sayable inside a seven-minute slot. */
const SURFACES: Array<[string, string]> = [
  ["Consumer app", "Wallet, chat, payments, agent cash — iOS, Android, watchOS"],
  ["Merchant portal", "API keys, invoices, payouts, settlements, mandates"],
  ["Admin back office", "40+ areas: KYC, disputes, float, risk, reconciliation"],
  ["Developer platform", "OAuth 2.0 + PKCE, hosted checkout, sandboxed mini-apps"],
];

export function BuiltSlide() {
  return (
    <Slide id="built">
      <SlideHead
        id="built"
        eyebrow="§1.7 · The artefact"
        title={
          <>
            Not a prototype. A <span className="accent">running system</span>, verified against
            the repository.
          </>
        }
      />

      <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric, i) => (
          <li
            key={metric.label}
            className="anim border-t border-[var(--line-strong)] pt-4"
            style={stagger(3 + i)}
          >
            <span className="mono block text-[clamp(1.7rem,3.2vw,2.5rem)] leading-none font-semibold tracking-tight">
              {metric.value}
            </span>
            <span className="mt-2.5 block text-[0.9rem] font-medium">{metric.label}</span>
            <span className="body-sm mt-1 block text-[0.8rem]">{metric.sub}</span>
          </li>
        ))}
      </ul>

      <ul className="mt-[clamp(1.8rem,4vh,3rem)] grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {SURFACES.map(([name, body], i) => (
          <li key={name} className="anim" style={stagger(7 + i)}>
            <h3 className="text-[0.95rem] font-semibold tracking-[-0.01em]">{name}</h3>
            <p className="body-sm mt-1.5">{body}</p>
          </li>
        ))}
      </ul>

      <p
        className="body-sm mt-[clamp(1.4rem,3vh,2.2rem)] anim border-l-2 border-[var(--accent)] pl-4 max-w-[88ch]"
        style={stagger(11)}
      >
        Every quantitative claim in the thesis was re-verified against the repository at commit{" "}
        <span className="mono accent">9678fa5a</span>, and each figure is reproducible with the
        commands in the appendix.
      </p>
    </Slide>
  );
}
