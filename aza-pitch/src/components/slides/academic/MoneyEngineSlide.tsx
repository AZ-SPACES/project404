import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const BEFORE = [
  "Verify the 4-digit passcode hash",
  "Idempotency key already seen? Return the prior result",
  "LimitGuard — per-transfer and rolling daily total",
];

const INSIDE = [
  "SELECT … FOR UPDATE on the sender wallet",
  "SELECT … FOR UPDATE on the recipient wallet, canonically ordered",
  "Enforce the recipient wallet ceiling",
  "Debit sender, credit recipient, write Transaction(COMPLETED)",
  "AuditService.record(…) — inside the same transaction",
];

const AFTER = [
  "RiskEngineService.evaluateTransfer — never fails the transfer",
  "WebSocket event, push notification, SMS and email",
];

function Step({ text }: { text: string }) {
  return (
    <li className="flex gap-3 body-sm">
      <span aria-hidden="true" className="mono text-[var(--text-tertiary)] pt-px">
        ·
      </span>
      <span>{text}</span>
    </li>
  );
}

export function MoneyEngineSlide() {
  return (
    <Slide id="money-engine">
      <SlideHead
        id="money-engine"
        eyebrow="§5.3 · The transfer flow"
        title={
          <>
            Every balance mutation commits inside{" "}
            <span className="accent">one boundary</span>. Every external effect happens after
            it.
          </>
        }
      />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[1.15fr_0.85fr] items-start">
        <div className="anim" style={stagger(3)}>
          <ul className="space-y-2.5">
            {BEFORE.map((step) => (
              <Step key={step} text={step} />
            ))}
          </ul>

          {/* The boundary is drawn, not described — it is the whole argument of the slide. */}
          <div className="relative my-4 rounded-[var(--radius)] border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] p-5">
            <span className="eyebrow absolute -top-2.5 left-4 bg-[var(--bg)] px-2" style={{ gap: "0.5rem" }}>
              <span className="accent">@Transactional</span>
            </span>
            <ul className="space-y-2.5 mt-1">
              {INSIDE.map((step) => (
                <Step key={step} text={step} />
              ))}
            </ul>
            <p className="mono mt-4 text-[0.7rem] tracking-[0.12em] uppercase accent">
              ── commit here ──
            </p>
          </div>

          <ul className="space-y-2.5">
            {AFTER.map((step) => (
              <Step key={step} text={step} />
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="card anim" style={stagger(4)}>
            <h3 className="eyebrow">Concurrency safety</h3>
            <p className="body-sm mt-3">
              Balance updates never use read-modify-write in Java. The repository exposes
              explicit pessimistic-lock finders, so two parallel transfers from the same wallet
              serialise on the row lock — a double-spend is impossible at the database level
              rather than at the application level.
            </p>
            <pre className="mono mt-4 overflow-x-auto text-[0.72rem] leading-relaxed text-[var(--text-secondary)]">
              <code>{`@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT w FROM Wallet w WHERE …")
Optional<Wallet> findByUserIdForUpdate(UUID id);`}</code>
            </pre>
          </div>

          <p className="body-sm anim border-l-2 border-[var(--accent)] pl-4" style={stagger(5)}>
            The inverse — firing the external effect and debiting on the callback — is
            explicitly prohibited. It is the ordering that turns a dropped webhook into a
            no-op instead of into missing money.
          </p>
        </div>
      </div>
    </Slide>
  );
}
