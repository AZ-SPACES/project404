import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

export function ProblemSlide() {
  return (
    <Slide id="problem">
      <SlideHead
        id="problem"
        eyebrow="The problem · Cash in, cash out"
        title={
          <>
            A closed loop is cheap to run. It just cannot{" "}
            <span className="accent">take your cash</span>.
          </>
        }
        lede="Everything inside AZA already works: wallet-to-wallet transfers, chat payments, merchant payments and money requests settle instantly on our own ledger. What the system cannot do on its own is exchange physical cash for wallet balance in either direction — and in this market, cash is still how most money arrives."
      />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-3 items-start">
        {[
          [
            "No PSP to lean on",
            "Because AZA deliberately uses no third-party payment processor, there is no provider deposit rail to fall back on. The cost advantage and the cash problem are the same decision.",
          ],
          [
            "The proven answer",
            "An agent network, layered on the internal transfer system that already exists — the model M-Pesa and MTN MoMo both scaled on. It is not a novel mechanism, and that is the point.",
          ],
          [
            "The insight that makes it cheap",
            "A cash deposit or withdrawal at an agent is just an internal wallet-to-wallet transfer between the agent’s float wallet and the user’s. Money never enters or leaves the AZA ledger through these transactions.",
          ],
        ].map(([term, body], i) => (
          <div key={term} className="anim" style={stagger(3 + i)}>
            <h3 className="text-[1.02rem] font-semibold tracking-[-0.015em]">{term}</h3>
            <p className="body-sm mt-3">{body}</p>
          </div>
        ))}
      </div>

      <p className="body-sm mt-9 anim border-l-2 border-[var(--accent)] pl-4 max-w-[92ch]" style={stagger(6)}>
        Which means the existing double-entry ledger, reconciliation and safeguarding controls all
        still hold when the agent network switches on. The cash network is a{" "}
        <span className="text-[var(--text)]">distribution problem</span>, not a re-architecture.
      </p>
    </Slide>
  );
}
