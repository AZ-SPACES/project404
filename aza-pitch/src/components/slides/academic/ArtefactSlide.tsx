import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const ROWS: Array<[string, string, string, string]> = [
  ["Backend", "Java 21 · Spring Boot 4.0.6", "64,867 LOC · 767 files", "61,330 / 745"],
  ["— Flyway migrations", "", "62 (V1 → V64)", "57"],
  ["— backend tests", "JUnit 5 · Mockito · Testcontainers", "53 classes · 509 tests", "40 / 374"],
  ["Mobile app", "React Native 0.86 · Expo 57", "103,132 LOC · 171 screens", "98,733 / 170"],
  ["— unit tests", "Jest · RNTL", "24 suites · 326 tests", "17 / 254"],
  ["— E2E flows", "Maestro", "20 flows", "20"],
  ["— watchOS companion", "Swift · SwiftUI · WidgetKit", "1 app + 3 complications", "—"],
  ["Five Next.js surfaces", "Next.js 16", "63,247 LOC", "60,102"],
  ["Mini apps + SDK", "TypeScript", "7 reference apps + published SDK", "same"],
];

export function ArtefactSlide() {
  return (
    <Slide id="artefact" dense>
      <SlideHead
        id="artefact"
        eyebrow="§1.7 · Scale of the artefact"
        title={
          <>
            <span className="accent">≈253,000 lines</span> across eight deployables, over 750
            commits.
          </>
        }
        lede="Measured 2026-09-06, with the 2026-08-21 column retained because the movement between them is part of the evidence. Every figure is reproducible from the repository with the commands in the appendix."
      />

      <div className="scroll-x anim" style={stagger(3)}>
        <table className="dtable min-w-[680px]">
          <thead>
            <tr>
              <th>Component</th>
              <th>Stack</th>
              <th>2026-09-06</th>
              <th>2026-08-21</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([component, stack, now, then]) => (
              <tr key={component}>
                <td className={component.startsWith("—") ? "pl-4 text-[var(--text-secondary)]" : ""}>
                  {component}
                </td>
                <td>{stack}</td>
                <td className="num">{now}</td>
                <td className="text-[var(--text-tertiary)] mono">{then}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="body-sm mt-6 anim" style={stagger(4)}>
        Built between 14 March and 3 September 2026 by two principal contributors. Every
        quantitative claim in the written thesis was re-verified against the repository at
        commit <span className="mono accent">9678fa5a</span>.
      </p>
    </Slide>
  );
}
