import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const SCENARIOS: Array<{ path: string; revenue: string; cost: string; net: string }> = [
  {
    path: "Cash-in ₵100 → P2P transfer → cash-out ₵100",
    revenue: "₵0.50 P2P fee + ₵1.00 cash-out fee",
    cost: "₵0.20 cash-in + ₵0.50 cash-out commission",
    net: "≈ ₵0.80",
  },
  {
    path: "Cash-in ₵100 → spent at a merchant (1% MDR)",
    revenue: "₵1.00 MDR, paid by the merchant",
    cost: "₵0.20 cash-in commission",
    net: "≈ ₵0.80–1.30",
  },
  {
    path: "Cash-in ₵100 → held 30 days → spent at a merchant",
    revenue: "₵1.00 MDR + ~₵0.15 net float interest",
    cost: "₵0.20 cash-in commission",
    net: "≈ ₵0.95–1.45",
  },
];

export function UnitEconomicsSlide() {
  return (
    <Slide id="unit-economics" dense>
      <SlideHead
        id="unit-economics"
        eyebrow="Unit economics"
        title={
          <>
            What <span className="accent">₵100</span> is worth, depending on how it leaves.
          </>
        }
        lede="The same deposit earns roughly twice as much when it is spent digitally as when it is withdrawn as cash — and it earns most when it sits in the wallet first. That gap is the entire strategy."
      />

      <div className="scroll-x anim" style={stagger(3)}>
        <table className="dtable min-w-[760px]">
          <thead>
            <tr>
              <th>Scenario — ₵100 enters AZA</th>
              <th>AZA revenue</th>
              <th>AZA cost</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((scenario) => (
              <tr key={scenario.path}>
                <td className="font-medium">{scenario.path}</td>
                <td>{scenario.revenue}</td>
                <td>{scenario.cost}</td>
                <td className="num accent font-semibold whitespace-nowrap">{scenario.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-x-12 gap-y-6 lg:grid-cols-2">
        <p className="body-sm anim border-l-2 border-[var(--warn)] pl-4" style={stagger(4)}>
          <span className="text-[var(--text)] font-medium">These are illustrative figures</span>{" "}
          against suggested rates, not measured results — there is no live volume yet. They are
          modelled to show the shape of the margin, and every rate behind them is on the fee
          slides that follow.
        </p>
        <p className="body-sm anim border-l-2 border-[var(--line-strong)] pl-4" style={stagger(5)}>
          <span className="text-[var(--text)] font-medium">Early on, agent commissions can
          consume 40–50% of revenue.</span>{" "}
          That is normal for this model and it falls as the digital ratio rises. A plan that
          pretends otherwise in year one is a plan that has not run an agent network.
        </p>
      </div>
    </Slide>
  );
}
