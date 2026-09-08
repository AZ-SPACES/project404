import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const HEADLINE = [
  { value: "509", label: "backend tests, 0 failures", sub: "53 classes · +135 in sixteen days" },
  { value: "326", label: "mobile tests, 0 failures", sub: "24 suites · typecheck 0 errors" },
  { value: "20", label: "Maestro end-to-end flows", sub: "on real device profiles" },
  { value: "87.75%", label: "statement coverage, src/crypto", sub: "scoped explicitly, so it means what it says" },
];

const COVERAGE: Array<[string, string, string]> = [
  ["Whole backend", "25.64%", "branches 21.23% · was 22.61%"],
  ["Money classes — original 13", "63.15%", "like-for-like · was 63.31%"],
  ["Money classes — current 17", "61.70%", "branches 47.93%"],
];

export function TestingSlide() {
  return (
    <Slide id="testing">
      <SlideHead
        id="testing"
        eyebrow="§11 · Testing and quality assurance"
        title={
          <>
            The tests are not distributed for coverage. They are{" "}
            <span className="accent">concentrated where money moves</span>.
          </>
        }
      />

      <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
        {HEADLINE.map((metric, i) => (
          <li key={metric.label} className="anim border-t border-[var(--line-strong)] pt-4" style={stagger(3 + i)}>
            <span className="mono block text-[clamp(1.7rem,3.2vw,2.5rem)] leading-none font-semibold tracking-tight">
              {metric.value}
            </span>
            <span className="mt-2.5 block text-[0.9rem] font-medium">{metric.label}</span>
            <span className="body-sm mt-1 block text-[0.8rem]">{metric.sub}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-x-12 gap-y-8 lg:grid-cols-[0.9fr_1.1fr] items-start">
        <div className="anim" style={stagger(7)}>
          <h3 className="eyebrow">Line coverage, JaCoCo</h3>
          <table className="dtable mt-4">
            <tbody>
              {COVERAGE.map(([label, value, note]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num text-right whitespace-nowrap">{value}</td>
                  <td className="text-[var(--text-tertiary)] text-[0.78rem]">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="anim border-l-2 border-[var(--accent)] pl-5" style={stagger(8)}>
          <h3 className="eyebrow">The money-path figure went down</h3>
          <p className="body-sm mt-3">
            Like-for-like it is flat. Adding the four new money classes takes it to 61.70%,
            because <span className="mono">SuperAgentService</span> — 603 lines, the newest money
            path — sits at 36.6% <span className="text-[var(--text)]">despite having 17 dedicated
            tests</span>. The other three additions are at 97%, 100% and 90%; one large new
            service outweighs them.
          </p>
          <p className="body-sm mt-3">
            <span className="text-[var(--text)] font-medium">
              A coverage percentage over a growing set is a lagging indicator
            </span>{" "}
            — new code drags it down even when the new code is tested. Both numbers are quoted,
            each with the set it is over, rather than letting an aggregate hide the named target.
          </p>
        </div>
      </div>

      <p className="body-sm mt-8 anim" style={stagger(9)}>
        The mobile aggregate is <span className="text-[var(--text)]">no longer quoted at all</span>:
        Jest instruments only files a test imports, which was 25 of 387 — so the figure was
        coverage of the tested subset, not of the codebase. A number with an unstated denominator
        is worse than no number.
      </p>
    </Slide>
  );
}
