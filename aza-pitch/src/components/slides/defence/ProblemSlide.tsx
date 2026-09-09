import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { SplitContextFigure } from "@/components/slides/defence/Diagrams";
import { stagger } from "@/lib/utils";

/* Three problems, one line each. The long-form statement of all three is on the
   academic track — this version exists to be *said* in forty seconds. */
const PROBLEMS: Array<[string, string, string]> = [
  ["01", "Settlement leaves the conversation", "Agree in chat, pay in MoMo, come back with a screenshot. Disputes are settled by image."],
  ["02", "Integration is per-operator", "No consumer OAuth identity, no hosted checkout with splits, no embedded app surface."],
  ["03", "Trust is asserted, not provable", "A user cannot verify a statement or a payment proof without a human vouching for it."],
];

export function ProblemSlide() {
  return (
    <Slide id="problem">
      <SlideHead
        id="problem"
        eyebrow="§1.1 · Background"
        title={
          <>
            Mobile money solved reach. It left three things{" "}
            <span className="accent">unsolved</span>.
          </>
        }
      />

      <div className="anim mb-[clamp(1.4rem,3vh,2.4rem)] max-w-[720px]" style={stagger(3)}>
        <SplitContextFigure />
      </div>

      <ol className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden md:grid-cols-3">
        {PROBLEMS.map(([n, title, body], i) => (
          <li
            key={n}
            className="bg-[var(--surface)] p-[clamp(1rem,1.9vw,1.5rem)] anim flex flex-col"
            style={stagger(4 + i)}
          >
            <span className="mono text-[0.72rem] tracking-[0.18em] text-[var(--accent)]">{n}</span>
            <h3 className="mt-3.5 text-[clamp(0.98rem,1.35vw,1.12rem)] font-semibold leading-snug tracking-[-0.01em]">
              {title}
            </h3>
            <p className="body-sm mt-2.5">{body}</p>
          </li>
        ))}
      </ol>
    </Slide>
  );
}
