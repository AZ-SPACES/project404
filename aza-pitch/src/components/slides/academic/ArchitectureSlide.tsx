import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const DEPLOYABLES: Array<[string, string, string]> = [
  ["backend", "The entire API, WebSocket broker, schedulers", "api.aza.systems"],
  ["aza-web", "Marketing, blog, legal, developer portal, API explorer, OAuth consent, public pay and verify pages", "aza.systems"],
  ["aza-admin", "Back office — 40+ operational areas: KYC, disputes, float, risk, reconciliation, filings", "admin.aza.systems"],
  ["aza-merchants", "Merchant self-service — API keys, invoices, payouts, settlements, webhooks, Connect, mandates", "merchants.aza.systems"],
  ["aza-pay", "Hosted checkout and mandate approval", "pay.aza.systems"],
  ["aza-superagents", "Master-agent console — downline, float distribution and recall, reconciliation", "superagents.aza.systems"],
  ["aza", "Consumer mobile app, with an embedded watchOS companion target", "App Store · Play Store"],
  ["nginx", "TLS, reverse proxy, static mini-app bundle serving", ":80 / :443"],
];

export function ArchitectureSlide() {
  return (
    <Slide id="architecture" dense>
      <SlideHead
        id="architecture"
        eyebrow="§4.2 · Deployable components"
        title={
          <>
            A modular monolith behind <span className="accent">eight</span> deployables.
          </>
        }
        lede="One Spring Boot application owns every write to the ledger. The surfaces around it are separate deployables with separate blast radii, but none of them holds a balance."
      />

      <div className="scroll-x anim" style={stagger(3)}>
        <table className="dtable min-w-[720px]">
          <thead>
            <tr>
              <th>Deployable</th>
              <th>Purpose</th>
              <th>Public host</th>
            </tr>
          </thead>
          <tbody>
            {DEPLOYABLES.map(([name, purpose, host]) => (
              <tr key={name}>
                <td className="mono whitespace-nowrap">{name}</td>
                <td>{purpose}</td>
                <td className="mono text-[var(--text-tertiary)] whitespace-nowrap">{host}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-7 grid gap-6 md:grid-cols-2">
        <p className="body-sm anim border-l-2 border-[var(--line-strong)] pl-4" style={stagger(4)}>
          <span className="text-[var(--text)] font-medium">Hosting.</span> The five Next.js apps
          are defined as Compose services so the whole stack comes up on one machine, but are
          deployed to Vercel in production. The droplet runs the API, PostgreSQL, Redis, nginx,
          the TURN relay and the mini-app bundles.
        </p>
        <p className="body-sm anim border-l-2 border-[var(--accent)] pl-4" style={stagger(5)}>
          <span className="text-[var(--text)] font-medium">The monolith was the right choice.</span>{" "}
          Balanced movement is enforceable precisely because wallet, transaction, hold and split
          writes share a database transaction. A microservice decomposition would have replaced a
          transactional method with a saga, and every invariant with an eventually-consistent
          approximation of one.
        </p>
      </div>
    </Slide>
  );
}
