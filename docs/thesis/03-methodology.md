# 3. Methodology

## 3.1 Development approach

The system was built with an **iterative, feature-sliced** approach rather than a
waterfall specification. Evidence for this is in the repository's own history: features
arrive as vertical slices (schema migration → entity → service → controller → client
screen) and are hardened by follow-up fix commits. Representative sequence from the
recent history:

```
feat: Akyede gifts and bill splitting
feat: bill payments
feat: weighted splits and netting
feat: recurring splits
feat: balances, settle-up, and recurring splits in the app
fix:  V51 altered a table no migration creates
fix:  V12 insert relied on a default a ddl-auto table never has
fix:  V50 retyped store sales through a CHECK that forbade the new type
```

### Version control practice

Worth a short subsection, because the commit history is itself evidence for §3.1's claim
about invariant-driven review. The remediation described in `16-verification-log.md` was
committed in **seven reviewable slices** rather than one bulk commit — one per concern,
each with a message that states the failure scenario before the fix:

```
d290807  chore: stop tracking aza/coverage, and version the thesis docs
468662e  fix: order wallet locks canonically and defer notifications past commit
664f65a  test: run the migration chain and a real concurrency experiment on Postgres
7580280  build: add JaCoCo and run *IT classes under surefire
4da0656  fix: repair two shipping bugs the mobile typecheck was hiding
d93fbeb  ci: run the mobile app's typecheck and tests
008055d  docs: add the thesis documentation set
```

The convention is Conventional Commits (`feat`, `fix`, `test`, `build`, `ci`, `chore`,
`docs`), applied to 308 of the repository's 694 commits. Where a commit fixes a defect,
the message records **what would have gone wrong**, not just what changed — the
lock-ordering commit describes the A→B / B→A deadlock cycle before describing
`WalletLocker`. That is a small discipline with a large payoff for a thesis: the history
becomes a citable record of reasoning rather than a list of edits.

### Measured development history

| Metric | Value |
|---|---|
| Total commits | **694** |
| Development window | 14 Mar 2026 → 15 Aug 2026 (**~5 months**) |
| Mean commit rate | ≈ 4.5 commits/day |
| Contributors | 2 principal (586 + 109 commits), plus automated Vercel commits |
| Commits by conventional-commit type | 210 `feat` · 49 `refactor` · 25 `fix` · 18 `chore` · 2 `test` · 2 `perf` · 2 `docs` |

Two things are worth drawing out of that table rather than leaving it as decoration.

**The feat:fix ratio is 8.4:1.** That is unusually high, and you should interpret it rather
than boast about it: it reflects a greenfield build in which most work was new surface, and
it also reflects that many corrective commits do not carry a `fix:` prefix (only 308 of 694
commits use conventional prefixes at all). Do not present it as a defect-density metric — it
is not one.

**`test` appears twice in 694 commits.** Tests were written alongside features inside `feat`
commits rather than as separate work, which is normal, but it also matches the gaps found in
Chapter 11: no mobile CI job, no coverage instrumentation, no integration tests against a
real database. State the connection honestly — the commit-type distribution is *evidence*
for the quality-assurance limitations reported in §11.8, not a contradiction of them.

Reproduce with:
```bash
git rev-list --count HEAD
git log --reverse --format="%ad" --date=short | head -1
git shortlog -sn --all
git log --format="%s" | grep -oE "^(feat|fix|docs|refactor|chore|test|perf|style)" | sort | uniq -c | sort -rn
```

For the thesis, characterise this as **incremental delivery with invariant-driven review**
— not Scrum, not XP, but a defensible engineering process with three explicit controls:

1. **Schema as versioned migration, never as inferred DDL.** The database is owned by
   Flyway (57 versioned scripts); Hibernate is set to `ddl-auto=validate` and may never
   alter the schema (`application.properties`). Every entity change must be accompanied by
   a migration or the application refuses to boot. This turns a whole class of production
   drift into a build failure.
2. **Money-path review as a formal gate.** Any change touching a wallet, transfer, payout,
   withdrawal, agent float, checkout or Connect path is reviewed against nine written
   financial invariants before merge. The checklist is codified at
   `.claude/skills/money-path-review/SKILL.md` and is reproduced in §5.4. It exists because
   a June 2026 audit found a withdrawal flow that credited a destination and never debited
   the source.
3. **Deploy preflight.** Migration backwards-compatibility, new environment variables,
   image build status and rollout readiness are checked before any production deploy
   (`.claude/skills/deploy-preflight/SKILL.md`).

> **Thesis framing:** these three controls are a *research artefact* in their own right.
> They are the answer to "how do you build a 220k-line financial system safely with a very
> small team?" Present them as a contribution, with the audit finding as the motivating
> incident.

## 3.2 Technology selection and justification

| Layer | Choice | Justification to give in the thesis |
|---|---|---|
| Backend language | Java 21 | Mature transactional/JPA ecosystem, strong static typing for money code, `BigDecimal` as a first-class decimal type, long-term support. |
| Backend framework | Spring Boot 4.0.6 | Declarative transaction boundaries (`@Transactional`), Spring Security filter chain, first-class JPA locking, mature observability. |
| Database | PostgreSQL 16 | ACID, `SELECT … FOR UPDATE` row locking, `NUMERIC(15,2)` exact decimal, mature constraint support (the ledger leans heavily on `CHECK` and `UNIQUE` constraints). |
| Cache / pub-sub | Redis 7 | OTP and rate-limit counters with TTL semantics; presence with a 65-second TTL; WebSocket fan-out across instances. |
| Schema management | Flyway | Versioned, replayable, auditable migrations; `baseline-on-migrate` to adopt a pre-existing ddl-auto schema without replaying one-shot data migrations. |
| Mobile | React Native 0.86 + Expo 57 | One codebase for iOS and Android; Expo modules give hardware-backed key storage (SecureStore), biometrics, camera and notifications without native code. |
| Mobile state | Zustand + TanStack Query | Small client-state store plus a server-cache layer, avoiding a monolithic Redux tree across 170 screens. |
| Web | Next.js 16 / React 19 / Tailwind 4 | Server components for the marketing and hosted-payment surfaces (fast first paint on low-end devices, important for the target market); one component idiom across four apps. |
| Crypto | `@noble/curves`, `@noble/ciphers`, `@noble/hashes` | Audited, dependency-free, constant-time JS implementations of X25519/Ed25519/AES-GCM/HKDF. Justify **not** rolling your own and **not** using a native module. |
| Realtime | STOMP over WebSocket | Structured pub/sub semantics over a single socket, with a Spring-native broker and an auth interceptor. |
| Containerisation | Docker + Compose | Reproducible runtime; a single-host deployment appropriate to the project's scale. |
| CI/CD | GitHub Actions + GHCR | Images are built in CI and only pulled on the server — never built on the droplet. |

## 3.3 Requirements elicitation

**[FILL IN — this is the section most likely to be marked down if you leave it thin.]**
State how requirements were obtained. Candidate sources you actually have:

- The product brief in `PRODUCT.md` (target users: 18–35 in Ghana; the explicit
  anti-references to Wave/Chipper/Cash App define a positioning requirement).
- Regulatory requirements derived from BoG/GSMA KYC-tiering and safeguarding expectations.
- Developer-facing requirements derived from writing the integration guides
  (`docs/AZA_CONNECT.md`, `SIGN_IN_WITH_AZA.md`) — writing the guide first and building to
  it is a legitimate, citable API-design method (documentation-driven development).
- The design specification produced before implementation for the holds feature
  (`HELD_SETTLEMENT_PLAN.md`) — this is a good exhibit: it shows a locked-decision table
  and an explicit vocabulary-design rationale before a line of code was written.
- **[FILL IN: any user interviews, surveys, or usability sessions you ran. If you ran
  none, say so and justify the alternative — a comparative feature analysis against MoMo,
  Chipper and Wave would substitute credibly.]**

## 3.4 Evaluation design

The system is evaluated on four axes. Chapter 7 reports results; the method is:

1. **Functional completeness** — trace each objective in §1.4 to implemented, tested
   artefacts. Instrument: the requirements traceability matrix in
   `12-results-and-evaluation.md`.
2. **Correctness of the money path** — the nine invariants of §5.4 are checked against
   every money-moving service, evidenced by targeted unit tests
   (`TransferServiceTest`, `CheckoutIdempotencyScopeTest`, `LimitGuardTest`,
   `HoldLedgerAuditServiceTest`, `SafeguardingHeldFloatTest`, `CashStructuringTest`).
3. **Security properties** — a stated threat model with a control mapped to each threat,
   plus the cryptographic test suite (`x3dh.test.ts`, `e2ee.test.ts`,
   `keystore.test.ts`, `mediaCrypto.test.ts`, `backupCrypto.test.ts`).
4. **Performance and robustness under concurrency** — **[FILL IN: run these]**
   - Concurrent-transfer test: N parallel transfers from one wallet; assert no
     double-spend and a final balance equal to the arithmetic expectation.
   - API latency under load (e.g. k6 or JMeter) for `POST /api/v1/transfers`,
     `GET /api/v1/wallet/balance`, checkout session creation.
   - WebSocket message delivery latency, cold-start time, and mobile bundle size.

## 3.5 Ethical considerations

- The system processes personal and financial data. Document the data-protection posture:
  soft-delete with a deletion scheduler (`@SQLDelete` on `User`,
  `DeletionSchedulerService`), GDPR-style erasure (`GdprErasureService`), subject data
  requests (`DataRequest`, `AdminDataRequestController`), consent records (`UserConsent`),
  and location-data retention limits (`LocationRetentionScheduler`).
- No real customer funds or real customer data are used in the evaluation.
  **[FILL IN: confirm and state this explicitly.]**
- Cryptographic claims are stated with their limits (no post-compromise security without a
  Double Ratchet) rather than overstated.
