import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const IN_SCOPE = [
  "Ghana only; Ghanaian Cedi only. Single currency, no FX.",
  "Internal rails: value moves between AZA wallets.",
  "Cash enters and leaves through the agent network and administered withdrawal flows.",
  "Consumer mobile app for iOS and Android, with a watchOS companion.",
  "Marketing and developer web, admin back office, merchant portal, hosted payment pages.",
  "Third-party integration by API key (server-to-server) and OAuth 2.0 (user-delegated).",
];

const OUT_OF_SCOPE = [
  ["Multi-currency and cross-border FX", "No rail, no exchange-rate code path anywhere in the tree."],
  ["Direct MNO / GhIPSS interconnection", "The architecture accommodates it — PAYOUT and DISBURSEMENT types exist — but no live rail is integrated."],
  ["Card acquiring and issuing", "Out of scope entirely."],
  ["Formal regulatory licensing", "Controls are modelled on Bank of Ghana e-money and KYC expectations. AZA is not a licensed EMI."],
  ["Formal cryptographic proof of the protocol", "The implementation follows X3DH; a Double Ratchet is designed for but not implemented."],
];

export function ScopeSlide() {
  return (
    <Slide id="scope">
      <SlideHead
        id="scope"
        eyebrow="§1.5 · Scope and delimitations"
        title={
          <>
            What was built, and what was <span className="accent">deliberately not</span>.
          </>
        }
      />

      <div className="grid gap-x-14 gap-y-9 md:grid-cols-2">
        <div className="anim" style={stagger(3)}>
          <h3 className="eyebrow">In scope — v1, as implemented</h3>
          <ul className="mt-5 space-y-3">
            {IN_SCOPE.map((item) => (
              <li key={item} className="body-sm flex gap-3">
                <span aria-hidden="true" className="accent mono pt-px">
                  +
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">Explicitly out of scope</h3>
          <ul className="mt-5 space-y-4">
            {OUT_OF_SCOPE.map(([term, body]) => (
              <li key={term}>
                <p className="text-[0.92rem] font-medium">{term}</p>
                <p className="body-sm mt-1">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="body-sm mt-9 anim border-l-2 border-[var(--accent)] pl-4 max-w-[80ch]" style={stagger(5)}>
        The licensing position is the single most likely viva question, so it is stated on the
        scope slide rather than defended when raised: the system implements the controls, and
        makes no claim to the licence.
      </p>
    </Slide>
  );
}
