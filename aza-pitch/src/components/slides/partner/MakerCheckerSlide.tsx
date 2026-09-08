import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const GATED: Array<[string, string[]]> = [
  [
    "Finance",
    ["Reverse transaction", "Update fee rule", "Unfreeze wallet", "Mint float", "Burn float", "Approve withdrawal", "Settle commission", "Admin fund transfer"],
  ],
  [
    "Compliance",
    ["Update user limits", "Reactivate user", "Approve KYC", "Approve agent", "Update agent terms"],
  ],
  [
    "Admin",
    ["Grant staff role", "Change staff role", "Update system settings", "Broadcast notification", "Enable mini app"],
  ],
];

const ASYMMETRY = [
  ["Freeze a wallet", "Unfreeze it"],
  ["Suspend a user", "Reactivate them"],
  ["Reject a KYC application", "Approve one"],
  ["Kill a mini app", "Re-enable it"],
];

export function MakerCheckerSlide() {
  return (
    <Slide id="maker-checker" dense>
      <SlideHead
        id="maker-checker"
        eyebrow="Dual control"
        title={
          <>
            Eighteen privileged actions require a{" "}
            <span className="accent">second pair of eyes</span>.
          </>
        }
        lede="Self-approval is rejected outright — including for administrators, because otherwise the control is decorative. The approver must additionally hold the action’s owning role, requests expire after seven days, and both submission and approval are written to the admin audit log."
      />

      <div className="grid gap-x-12 gap-y-9 lg:grid-cols-[1.15fr_0.85fr] items-start">
        <div>
          <h3 className="eyebrow anim" style={stagger(3)}>
            Gated actions by approver role
          </h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            {GATED.map(([role, actions], i) => (
              <div key={role} className="anim" style={stagger(4 + i)}>
                <p className="pill">{role}</p>
                <ul className="mt-3 space-y-1.5">
                  {actions.map((action) => (
                    <li key={action} className="body-sm text-[0.82rem]">
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="anim" style={stagger(7)}>
          <h3 className="eyebrow">The deliberate asymmetry</h3>
          <p className="body-sm mt-3">
            The restrictive direction is immediate. The permissive direction needs approval.
          </p>
          <ul className="mt-4 space-y-2.5">
            {ASYMMETRY.map(([immediate, gated]) => (
              <li key={immediate} className="flex items-center gap-3 text-[0.85rem]">
                <span className="pill pill--ok" style={{ minWidth: "9.5rem" }}>
                  {immediate}
                </span>
                <span aria-hidden="true" className="dim mono">
                  →
                </span>
                <span className="pill pill--warn">{gated}</span>
              </li>
            ))}
          </ul>
          <p className="body-sm mt-5 border-l-2 border-[var(--accent)] pl-4">
            A single staff member can always act to <span className="text-[var(--text)]">reduce</span>{" "}
            risk, and never alone to <span className="text-[var(--text)]">increase</span> it.
          </p>
          <p className="body-sm mt-4">
            The admin console additionally requires fresh two-factor elevation on top of a valid
            session, and can be restricted to office IP ranges.
          </p>
        </div>
      </div>
    </Slide>
  );
}
