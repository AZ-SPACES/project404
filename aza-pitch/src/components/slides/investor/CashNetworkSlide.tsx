import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const DEPOSIT = [
  "User hands ₵200 cash to a registered AZA agent.",
  "Agent initiates a CASH_IN transfer: ₵200 moves from the agent’s float wallet to the user’s wallet.",
  "User gets instant in-app confirmation. The agent now holds ₵200 more cash and ₵200 less float.",
];

const WITHDRAWAL = [
  "User generates a one-time withdrawal code — or a QR — in the app, for the amount.",
  "Agent redeems the code: a CASH_OUT transfer moves the amount from user wallet to agent float, plus fee.",
  "Agent hands over physical cash. Redemption is the proof of payment — an agent can never pull from a user wallet directly.",
];

function Flow({ title, tag, steps, index }: { title: string; tag: string; steps: string[]; index: number }) {
  return (
    <div className="anim" style={stagger(index)}>
      <div className="flex items-baseline gap-3">
        <h3 className="text-[1.15rem] font-semibold tracking-[-0.02em]">{title}</h3>
        <span className="mono text-[0.72rem] text-[var(--text-tertiary)]">{tag}</span>
      </div>
      <ol className="mt-5 space-y-4">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-4">
            <span
              className="mono flex-none grid place-items-center w-6 h-6 rounded-full border text-[0.7rem]"
              style={{ borderColor: "var(--line-strong)", color: "var(--accent)" }}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="body-sm pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CashNetworkSlide() {
  return (
    <Slide id="cash-network">
      <SlideHead
        id="cash-network"
        eyebrow="The cash network"
        title={
          <>
            Two flows. Both are just{" "}
            <span className="accent">internal transfers</span> with a physical leg.
          </>
        }
      />

      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-2">
        <Flow title="Deposit" tag="cash-in" steps={DEPOSIT} index={3} />
        <Flow title="Withdrawal" tag="cash-out" steps={WITHDRAWAL} index={4} />
      </div>

      <div className="mt-10 grid gap-x-12 gap-y-6 lg:grid-cols-2">
        <p className="body-sm anim border-l-2 border-[var(--accent)] pl-4" style={stagger(5)}>
          <span className="text-[var(--text)] font-medium">Why this is the cheap version.</span>{" "}
          No new settlement rail, no processor integration, no clearing. The agent network runs on
          the transfer engine that is already built and already tested.
        </p>
        <p className="body-sm anim border-l-2 border-[var(--line-strong)] pl-4" style={stagger(6)}>
          <span className="text-[var(--text)] font-medium">Why the code matters.</span> The
          withdrawal code is what makes the agent relationship safe to scale: the agent redeems
          proof the user generated, so a dishonest agent has nothing to debit against.
        </p>
      </div>
    </Slide>
  );
}
