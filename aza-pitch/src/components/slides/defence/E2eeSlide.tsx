import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const STAGES: Array<[string, string, string]> = [
  [
    "Built",
    "The objective was met",
    "X3DH over X25519/Ed25519, AES-256-GCM, per-device identities in hardware-backed storage, safety numbers. 87.75% coverage, in CI. It shipped and it worked.",
  ],
  [
    "Withdrawn",
    "A product constraint, not a legal one",
    "Under per-device E2EE, history belongs to a device, not an account. A replacement phone holds no keys — and both mitigations need the old phone, which is what a lost phone is not.",
  ],
  [
    "Replaced",
    "The Telegram cloud-chat model",
    "Bodies readable by the server so history follows the account, encrypted at rest so a stolen dump is still ciphertext.",
  ],
];

export function E2eeSlide() {
  return (
    <Slide id="e2ee">
      <SlideHead
        id="e2ee"
        eyebrow="§12.4a · The withdrawn security property"
        title={
          <>
            We built end-to-end encryption, then{" "}
            <span className="accent">deliberately withdrew it</span> — and reported it.
          </>
        }
        lede="A thesis that quietly downgrades its strongest claim between chapters is worse than one that never made it."
      />

      <ol className="grid gap-px bg-[var(--line)] border border-[var(--line)] rounded-[var(--radius)] overflow-hidden md:grid-cols-3">
        {STAGES.map(([stage, verdict, body], i) => (
          <li
            key={stage}
            className="bg-[var(--surface)] p-[clamp(1rem,1.9vw,1.5rem)] anim"
            style={stagger(3 + i)}
          >
            <h3 className="eyebrow">{stage}</h3>
            <p className="mt-3.5 text-[0.95rem] font-semibold tracking-[-0.01em]">{verdict}</p>
            <p className="body-sm mt-2.5">{body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-[clamp(1.4rem,3.2vh,2.4rem)] grid gap-x-12 gap-y-6 lg:grid-cols-2 items-start">
        <div className="anim border-l-2 border-[var(--bad)] pl-5" style={stagger(6)}>
          <h3 className="eyebrow">The cost, stated without softening</h3>
          <p className="mt-3 text-[clamp(1rem,1.5vw,1.18rem)] leading-snug font-medium">
            AZA can read its users&rsquo; messages. No amount of at-rest encryption changes that,
            because AZA holds the key.
          </p>
        </div>

        <div className="anim border-l-2 border-[var(--accent)] pl-5" style={stagger(7)}>
          <h3 className="eyebrow">Why this is the better result</h3>
          <p className="body-sm mt-3">
            It is a measured trade with both sides quantified, and it is the trade the large
            deployed messengers make for the same reason. The binding constraint on E2EE in
            consumer products is <span className="accent">device loss</span> — not law
            enforcement, and not compliance.
          </p>
        </div>
      </div>
    </Slide>
  );
}
