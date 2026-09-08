import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const METRICS = [
  { value: "253k", label: "lines of code", sub: "eight deployables, 750+ commits" },
  { value: "835", label: "automated tests passing", sub: "509 backend · 326 mobile · 0 failures" },
  { value: "62", label: "schema migrations", sub: "versioned, replayed in CI against real PostgreSQL" },
  { value: "9 / 9", label: "money invariants holding", sub: "enforced by a blocking review gate" },
];

export function BuiltSlide() {
  return (
    <Slide id="built">
      <SlideHead
        id="built"
        eyebrow="What already exists"
        title={
          <>
            This is not a deck for something that{" "}
            <span className="accent">has not been built</span>.
          </>
        }
        lede="The API is live. The five web surfaces are deployed. The money engine, the compliance layer, the merchant rail, the OAuth identity, the mini-app runtime and the super-agent console are all shipped code with tests around them, verified against the repository on 2026-09-06."
      />

      <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric, i) => (
          <li key={metric.label} className="anim border-t border-[var(--line-strong)] pt-4" style={stagger(3 + i)}>
            <span className="mono block text-[clamp(1.8rem,3.4vw,2.7rem)] leading-none font-semibold tracking-tight">
              {metric.value}
            </span>
            <span className="mt-3 block text-[0.92rem] font-medium">{metric.label}</span>
            <span className="body-sm mt-1.5 block text-[0.8rem]">{metric.sub}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-x-12 gap-y-6 lg:grid-cols-2">
        <p className="body-sm anim border-l-2 border-[var(--accent)] pl-4" style={stagger(7)}>
          <span className="text-[var(--text)] font-medium">What the capital buys</span> is
          therefore distribution — agents, float, merchant acquisition and the licence
          conversation — rather than a platform that still has to be written.
        </p>
        <p className="body-sm anim border-l-2 border-[var(--line-strong)] pl-4" style={stagger(8)}>
          <span className="text-[var(--text)] font-medium">Stated plainly:</span> there are no
          users yet and no transaction volume to report. Every figure on this slide is an
          engineering measurement, not a traction measurement, and none of them is presented as
          the latter.
        </p>
      </div>
    </Slide>
  );
}
