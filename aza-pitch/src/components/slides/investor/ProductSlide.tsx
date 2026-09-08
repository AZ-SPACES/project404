import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const SURFACES = [
  ["Consumer app", "Send, request, chat, scan, pay a shop, top up, pay bills. 171 screens across 16 feature domains, plus a watchOS companion.", "iOS · Android"],
  ["Merchant portal", "API keys, products, invoices, payouts, settlements, webhooks, marketplace splits, mandates, team. 29 self-service areas.", "merchants.aza.systems"],
  ["Hosted checkout", "A payment page and a mandate-approval page any business can link to without integrating anything.", "pay.aza.systems"],
  ["Agent consoles", "Master-agent float distribution and recall, downline management, reconciliation — the cash network’s operating surface.", "superagents.aza.systems"],
  ["Back office", "40+ operational areas: KYC, disputes, float, risk, reconciliation, regulatory filings.", "admin.aza.systems"],
  ["Developer platform", "Merchant APIs, OAuth 2.0 identity, payment mandates and a sandboxed mini-app runtime with seven reference apps.", "aza.systems"],
];

export function ProductSlide() {
  return (
    <Slide id="product" dense>
      <SlideHead
        id="product"
        eyebrow="The product"
        title={
          <>
            Six surfaces. <span className="accent">One ledger</span> underneath all of them.
          </>
        }
        lede="Competitors ship a wallet and then bolt a merchant product onto it through an aggregator. Every one of these writes to the same balance, in the same transaction, with the same audit trail — which is what makes instant settlement possible and reconciliation cheap."
      />

      <ul className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden md:grid-cols-2 lg:grid-cols-3">
        {SURFACES.map(([name, body, host], i) => (
          <li key={name} className="bg-[var(--surface)] p-[clamp(1rem,1.8vw,1.5rem)] anim flex flex-col" style={stagger(3 + i)}>
            <h3 className="text-[1rem] font-semibold tracking-[-0.015em]">{name}</h3>
            <p className="body-sm mt-2.5 flex-1">{body}</p>
            <p className="mono mt-4 text-[0.7rem] text-[var(--text-tertiary)]">{host}</p>
          </li>
        ))}
      </ul>
    </Slide>
  );
}
