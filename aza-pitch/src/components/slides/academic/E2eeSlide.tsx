import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const STAGES: Array<[string, string, string]> = [
  [
    "What was delivered",
    "The engineering objective was met",
    "X3DH over X25519/Ed25519 with HKDF-SHA256 and AES-256-GCM. Per-device identities in hardware-backed storage, one-time pre-keys consumed and deleted at decrypt time, three coexisting protocol versions for migration, canonical-JSON AAD, and safety numbers for the key-directory MITM. 87.75% statement coverage, running in CI. It shipped and it worked.",
  ],
  [
    "Why it was withdrawn",
    "A product constraint, not a regulatory one",
    "Under per-device E2EE, chat history belongs to a device, not to an account. A replacement phone holds no key material, so no envelope on the server can be opened by it. Both mitigations built for this — ChatBackup and HistoryTransfer — require the old device to be present and cooperative, which is precisely what a lost phone is not.",
  ],
  [
    "What replaced it",
    "The Telegram cloud-chat model",
    "Bodies are readable by the server so it can serve history to any device that authenticates as the account, and are encrypted at rest under CHAT_CONTENT_KEY so a stolen dump is still ciphertext.",
  ],
];

export function E2eeSlide() {
  return (
    <Slide id="e2ee" dense>
      <SlideHead
        id="e2ee"
        eyebrow="§12.4a · The withdrawn security property"
        title={
          <>
            The strongest claim the system made was{" "}
            <span className="accent">withdrawn</span> — and reported.
          </>
        }
        lede="On 2026-09-02, end-to-end encryption for new messages was retired. A thesis that quietly downgrades its strongest claim between chapters is worse than one that never made it."
      />

      <ol className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden md:grid-cols-3">
        {STAGES.map(([stage, verdict, body], i) => (
          <li key={stage} className="bg-[var(--surface)] p-[clamp(1rem,1.8vw,1.5rem)] anim" style={stagger(3 + i)}>
            <h3 className="eyebrow">{stage}</h3>
            <p className="mt-3.5 text-[0.95rem] font-semibold tracking-[-0.01em]">{verdict}</p>
            <p className="body-sm mt-2.5">{body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-7 grid gap-x-12 gap-y-7 lg:grid-cols-2 items-start">
        <div className="anim border-l-2 border-[var(--bad)] pl-5" style={stagger(6)}>
          <h3 className="eyebrow">The cost, stated without softening</h3>
          <p className="mt-3 text-[clamp(1rem,1.5vw,1.2rem)] leading-snug font-medium">
            AZA can read its users’ messages. No amount of at-rest encryption changes that,
            because AZA holds the key.
          </p>
        </div>

        <div className="anim" style={stagger(7)}>
          <h3 className="eyebrow">Why this is the better result</h3>
          <ol className="mt-3 space-y-2.5">
            {[
              "It is a measured engineering trade with both sides quantified, not a capability never attempted. Per-device fan-out costs O(devices) storage and bandwidth plus two synchronous key-bundle fetches per cold send — and after paying all of it, still cannot serve device n+1.",
              "It is the trade the large deployed messengers make, for the same reason. Signal holds the line and pays with history that does not follow the account; WhatsApp pays with a recovery key users lose.",
              "The honest reporting of a withdrawn property is itself a result. Leaving the claim intact because the code is still in the repository would have been false in a way no examiner could check without reading the send path.",
            ].map((point, i) => (
              <li key={point} className="body-sm flex gap-3">
                <span className="mono accent pt-px">{i + 1}</span>
                <span>{point}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="body-sm mt-7 anim max-w-[92ch]" style={stagger(8)}>
        <span className="text-[var(--text)] font-medium">The general form.</span> The binding
        constraint on end-to-end encryption in consumer products is{" "}
        <span className="accent">device loss</span> — not law enforcement and not compliance. AZA
        never needed to read message content to meet its obligations, because the obligations
        attach to the ledger. Any design that treats compliance as the adversary will still lose
        to a dropped phone.
      </p>
    </Slide>
  );
}
