import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const HOLDS = [
  "TLS with certificate pinning in transit.",
  "Chat bodies and media keys encrypted at rest.",
  "Media blobs never decryptable by the media host.",
  "A user-held recovery key for backups.",
  "Hardware-backed key storage on device.",
  "Fresh 2FA step-up and optional IP allowlisting on the admin console.",
];

export function SecuritySlide() {
  return (
    <Slide id="security">
      <SlideHead
        id="security"
        eyebrow="Security posture"
        title={
          <>
            One property was built, deployed, and then{" "}
            <span className="accent">deliberately withdrawn</span>.
          </>
        }
        lede="AZA previously offered end-to-end encrypted chat. On 2026-09-02 that was retired for new messages. It is stated here because a partner or supervisor who discovers it later is entitled to ask why it was not."
      />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[1fr_1fr] items-start">
        <div className="anim border-l-2 border-[var(--bad)] pl-5" style={stagger(3)}>
          <h3 className="eyebrow">What changed, and the cost</h3>
          <p className="body-sm mt-3">
            Under per-device encryption, chat history belongs to a device rather than to an
            account. A replacement phone holds no key material and can open nothing. In a market
            where a phone is frequently the user’s only device, “your messages are gone” is not an
            edge case.
          </p>
          <p className="mt-4 text-[1.02rem] font-medium leading-snug">
            Message bodies are now readable by AZA. At-rest encryption does not change that,
            because AZA holds the key.
          </p>
        </div>

        <div className="anim" style={stagger(4)}>
          <h3 className="eyebrow">What the change did not affect</h3>
          <p className="body-sm mt-3">
            Nothing about the ledger, the audit trail or the money controls. The regulatory
            obligations attach to value movement, not to message content — which is why encrypted
            messaging and supervisory obligation were compatible in the first place. What broke
            end-to-end encryption was a product requirement about device loss, not a compliance
            one.
          </p>
          <ul className="mt-4 space-y-2">
            {HOLDS.map((item) => (
              <li key={item} className="body-sm flex gap-2.5">
                <span aria-hidden="true" className="accent mono pt-px">
                  +
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Slide>
  );
}
