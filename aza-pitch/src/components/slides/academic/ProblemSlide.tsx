import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const PROBLEMS = [
  {
    n: "01",
    title: "Settlement is divorced from the conversation that caused it",
    body:
      "People agree a payment in WhatsApp, switch to USSD or a MoMo app, transact, screenshot the receipt, and return to the chat. Context and settlement live in different places — so disputes are resolved by screenshot.",
  },
  {
    n: "02",
    title: "Interoperability is transaction-level, not product-level",
    body:
      "A merchant or developer who wants to build on the rails must negotiate with each operator or route through an aggregator. There is no consumer-grade OAuth identity, no hosted checkout with marketplace splits, no embedded app surface.",
  },
  {
    n: "03",
    title: "Trust is asserted, not demonstrated",
    body:
      "A consumer cannot independently verify a statement, a payment proof or a merchant identity without a human intermediary standing behind it.",
  },
];

export function ProblemSlide() {
  return (
    <Slide id="problem">
      <SlideHead
        id="problem"
        eyebrow="Chapter 1 · Background"
        title={
          <>
            Mobile money solved reach. It left three things{" "}
            <span className="accent">unsolved</span>.
          </>
        }
        lede="Ghana’s retail payments landscape is dominated by MoMo issued by mobile network operators. Anyone with a SIM can hold value — but for the population that transacts most, three problems remain."
      />

      <ol className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden md:grid-cols-3">
        {PROBLEMS.map((problem, i) => (
          <li
            key={problem.n}
            className="bg-[var(--surface)] p-[clamp(1.1rem,2vw,1.7rem)] anim flex flex-col"
            style={stagger(3 + i)}
          >
            <span className="mono text-[0.72rem] tracking-[0.18em] text-[var(--accent)]">
              {problem.n}
            </span>
            <h3 className="mt-4 text-[clamp(0.98rem,1.35vw,1.15rem)] font-semibold leading-snug tracking-[-0.01em]">
              {problem.title}
            </h3>
            <p className="body-sm mt-3">{problem.body}</p>
          </li>
        ))}
      </ol>
    </Slide>
  );
}
