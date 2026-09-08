import { Slide } from "@/components/deck/Slide";
import { SlideHead } from "@/components/deck/SlideHead";
import { stagger } from "@/lib/utils";

const CONTRIBUTIONS = [
  {
    n: "01",
    title: "An integrated architecture",
    body:
      "Encrypted messaging and regulated value transfer sharing one transactional boundary, one identity and one audit trail — with a concrete account of the invariants that make it safe.",
  },
  {
    n: "02",
    title: "A documented set of financial invariants",
    body:
      "Balanced movement, debit-before-external-effect, tenant-scoped idempotency, lock-based concurrency, maker–checker — and a review methodology that operationalises them as an executable gate.",
  },
  {
    n: "03",
    title: "A multi-device E2EE design, and why it was traded away",
    body:
      "X3DH with per-device identities and server-opaque backups, then the measured argument that per-device encryption and account-owned history are incompatible without a cooperating old device. The second half is the more valuable half: designs of the first kind are well represented in the literature; honest reports of retiring one in production are not.",
    starred: true,
  },
  {
    n: "04",
    title: "A developer platform pattern for an African fintech",
    body:
      "Hosted checkout with marketplace splits to non-merchant sellers, delegated payment mandates, and a sandboxed mini-app runtime with an explicit permission and consent model.",
  },
  {
    n: "05",
    title: "An empirical engineering account",
    body:
      "Building ≈253,000 lines across eight deployables with the delivery controls that keep a money path safe over 62 schema migrations — two mechanical verification passes, ten findings, and the movement from six of nine invariants to nine of nine.",
  },
  {
    n: "06",
    title: "Enforcement by construction beats verification by inspection",
    body:
      "With the counter-example that makes the point: invariant 4 was verified as holding by tracing every documented money path, and three writers on undocumented paths took no lock.",
    starred: true,
  },
];

export function ContributionsSlide() {
  return (
    <Slide id="contributions" dense>
      <SlideHead
        id="contributions"
        eyebrow="§1.6 · Contributions"
        title={
          <>
            Six claims the thesis is prepared to <span className="accent">defend</span>.
          </>
        }
      />

      <ol className="grid gap-x-12 gap-y-6 md:grid-cols-2">
        {CONTRIBUTIONS.map((item, i) => (
          <li
            key={item.n}
            className="anim flex gap-4 border-t pt-4"
            style={{
              ...stagger(3 + i),
              borderColor: item.starred ? "var(--accent)" : "var(--line)",
            }}
          >
            <span className="mono text-[0.72rem] tracking-[0.16em] text-[var(--text-tertiary)] pt-1">
              {item.n}
            </span>
            <div>
              <h3 className="text-[0.98rem] font-semibold tracking-[-0.01em]">{item.title}</h3>
              <p className="body-sm mt-1.5">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Slide>
  );
}
