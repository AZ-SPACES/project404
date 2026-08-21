# 15. Figures, Tables and Appendices

A thesis is judged partly on its figures. Here is every diagram worth drawing, where its
source data lives, and which chapter it belongs in.

## 15.1 Figures to produce

| # | Figure | Source | Chapter |
|---|---|---|---|
| 1 | High-level system context (clients → nginx → backend → data → external services) | Mermaid in `04-system-architecture.md` §4.1 | 4 |
| 2 | Deployment topology (Cloudflare / Vercel / droplet / mini-app origins) | Mermaid in §4.6 | 4 |
| 3 | Backend package/layer diagram | §4.3 tree | 4 |
| 4 | Request pipeline through the security filter chain | Mermaid in §4.3 | 4 |
| 5 | ER diagram — users, wallets, transactions, merchants, agents | Mermaid in `05-backend-design.md` §5.2; expand from `entity/` | 4 |
| 6 | ER diagram — chat, key bundles, ciphertexts, backups | `entity/Chat*`, `MessageCiphertext`, `UserKeyBundle` | 4 |
| 7 | ER diagram — merchant, checkout, splits, holds, settlements | `entity/Merchant*`, `CheckoutSession*`, `PaymentHold` | 4 |
| 8 | Transfer sequence diagram | Mermaid in §5.3 | 5 |
| 9 | Concurrency: two transfers serialising on a `FOR UPDATE` row lock | Draw from `WalletRepository` | 5 |
| 10 | State machine of `TransactionStatus` (8 states, incl. `HELD_FOR_REVIEW`) | `entity/Transaction.java` | 5 |
| 11 | KYC tier ladder with limits | `entity/KycTier.java` | 5 |
| 12 | Fee decision flow (free-per-txn → free-monthly → percentage → min/max cap) | `FeeCalculationService`, `V23` | 5 |
| 13 | Agent cash-in/cash-out flow, showing commission accrued as a payable not e-money | `V24__agents.sql`, `AgentCashService` | 5 |
| 14 | Safeguarding position: issued e-money vs safeguarded balance vs agent float | `SafeguardingSnapshot`, `WalletRepository` sums | 5 |
| 15 | **X3DH handshake** — IK/SPK/OPK/EK and the four DH operations | `aza/src/crypto/e2ee.ts` header | 6 |
| 16 | E2EE message envelope wire format | §6.3 | 6 |
| 17 | Key hierarchy and storage locations (device SecureStore vs server) | §6.3 table | 6 |
| 18 | Media encryption pipeline (capture → compress → encrypt → upload → decrypt at render) | `mediaCrypto.ts`, `useDecryptedMediaUri` | 6 |
| 19 | Audit anchor hash chain | `AuditAnchorService` | 6 |
| 20 | Threat model matrix as a diagram | §6.1 | 6 |
| 21 | Mobile navigation hierarchy | Mermaid in `07-mobile-application.md` | 5 |
| 22 | Provider composition order in the mobile app shell | `aza/src/providers/` | 5 |
| 23 | Hosted checkout sequence | Mermaid in `09-platform-apis.md` §9.2 | 5 |
| 24 | AZA Connect split vs direct transfer, with the money arithmetic | §9.3 | 5 |
| 25 | OAuth QR login sequence | §9.4 | 5 |
| 26 | Mini-app permission and consent flow | §9.5 | 5 |
| 27 | CI/CD pipeline | `.github/workflows/` | 6 |
| 28 | Flyway baselining: fresh DB vs adopted DB paths | §10.3 | 6 |
| 29 | Screenshot plate — mobile app key screens | Run the app; see below | 5/7 |
| 30 | Screenshot plate — admin, merchant and checkout surfaces | Run the web apps | 5/7 |
| 31 | Maker–checker asymmetry — restrictive actions immediate, permissive actions gated | `05-backend-design.md` §5.8 | 5 |
| 32 | E-money creation and destruction — `mint`/`burn` as the only paths that change total issuance | §5.5 | 5 |
| 33 | Certificate-pinning evolution — leaf pins (broke twice) → root-CA pins + expiry valve | `06-security-and-cryptography.md` §6.5 | 5/6 |
| 34 | Multi-device ciphertext fan-out — one `MessageCiphertext` row per (message, device) | §6.3 | 5 |
| 35 | Finding F1 — the deadlock cycle, and how canonical ordering removes it | `16-verification-log.md` §16.2 | 6/7 |
| 36 | Finding F2 — effect timing before and after `AfterCommitExecutor` | §16.2 | 6/7 |
| 37 | **The concurrency experiment result** — 100 parallel debits, 50 succeed, balance 0 | `12-results-and-evaluation.md` §12.5 | 7 |
| 38 | Coverage: whole backend vs money classes, side by side | §11.7 | 7 |
| 39 | The verification pass as a process — invariants → check → findings → fix → test | Ch. 3 + §16.1 | 3/7 |
| 40 | CI pipeline before and after the mobile job | `10-devops-and-deployment.md` §10.1 | 6 |

**Diagram tooling.** The Mermaid blocks in these files render directly in GitHub, Typora,
Obsidian and VS Code, and export to SVG/PNG via `mmdc` (`@mermaid-js/mermaid-cli`) for
inclusion in LaTeX or Word. Keep the source in the repo so the figures stay reproducible.

## 15.2 Screenshots to capture

Aim for a two-page plate rather than a screenshot per page.

**Mobile (device frame, dark theme):** onboarding · home with balance · send flow
(contact → amount → confirm → PIN → success) · chat conversation with an in-chat payment ·
split creation · QR scan and merchant checkout · KYC ID capture · security settings
showing the 2FA methods · chat-info screen showing the **safety number** · mini-app hub and
a running mini app.

**Web:** admin dashboard · admin approvals queue (maker–checker) · admin risk/flagged
transactions · merchant dashboard · merchant API keys with live/test distinction ·
`aza-pay` checkout page · mandate approval page · developer API explorer · public
verification page.

## 15.3 Tables to include

| Table | Source |
|---|---|
| Scale of the artefact | `01-introduction.md` §1.7 |
| Technology stack with justification | `03-methodology.md` §3.2 |
| Deployable components | `04-system-architecture.md` §4.2 |
| Principal types and their credentials | §4.4 |
| Security-relevant configuration defaults | §4.7 |
| Domain → entity → service map | `05-backend-design.md` §5.1 |
| Fee catalogue | §5.2 |
| KYC tier limits | §5.2 |
| **The nine financial invariants** | §5.4 |
| Agent commission parameters | §5.5 |
| Threat model | `06-security-and-cryptography.md` §6.1 |
| Key hierarchy | §6.3 |
| Application security controls | §6.4 |
| Mobile feature domains and screen counts | `07-mobile-application.md` §7.2 |
| Mini-app permissions | `09-platform-apis.md` §9.5 |
| Migration failure modes encountered | `10-devops-and-deployment.md` §10.3 |
| Backend test inventory | `11-testing-and-quality.md` §11.2 |
| Requirements traceability matrix | `12-results-and-evaluation.md` §12.1 |
| Invariant conformance | §12.3 |
| Performance results | §12.5 |
| Competitive comparison | §12.6 |
| Limitations | `13-limitations-and-future-work.md` §13.1 |
| **Verification summary — 18 checks, 5 findings, 4 fixed** | `16-verification-log.md` §16.1 |
| Concurrency experiment results | `12-results-and-evaluation.md` §12.5 |
| Coverage — backend aggregate vs money classes | `11-testing-and-quality.md` §11.7 |
| Maker–checker action inventory (18 actions × approver role) | `05-backend-design.md` §5.8 |
| Webhook delivery properties | `09-platform-apis.md` §9.6 |
| Measured development history (694 commits, commit-type distribution) | `03-methodology.md` §3.1 |

## 15.4 Appendices

| Appendix | Content | Source |
|---|---|---|
| A | Full API endpoint listing | `mvn spring-boot:run` then `GET /v3/api-docs`, or enumerate `controller/` |
| B | Complete database schema | Concatenate `backend/src/main/resources/db/migration/*.sql`, or `pg_dump --schema-only` |
| C | E2EE protocol specification | `aza/src/crypto/e2ee.ts` + §6.3 |
| D | The nine money invariants and the review method | `.claude/skills/money-path-review/SKILL.md` |
| E | Developer integration guides | `docs/AZA_CONNECT.md`, `SIGN_IN_WITH_AZA.md`, `miniapps/aza-sdk/docs/` |
| F | Design record: payment holds | `HELD_SETTLEMENT_PLAN.md` |
| G | Test inventory and coverage reports | §11.2; generated JaCoCo / Jest reports |
| H | Postman collections | `docs/AZA_Backend.postman_collection.json`, `docs/aza-connect.postman_collection.json` |
| I | Deployment and operations runbook | `10-devops-and-deployment.md`, `backend/docs/SECRETS_ROTATION.md` |
| **J** | **Verification log** — 14 mechanical checks with commands, results and three findings | `16-verification-log.md` |

## 15.5 Commands to regenerate the evidence

```bash
# Line counts
find backend/src/main/java -name '*.java' | xargs wc -l | tail -1
find aza/src \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1
for a in aza-web aza-admin aza-merchants aza-pay; do
  printf '%s: ' "$a"; find "$a/src" \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1
done

# Component counts
ls backend/src/main/java/com/aza/backend/{controller,service,entity,repository} | wc -l
find backend/src/main/java/com/aza/backend/dto -name '*.java' | wc -l
ls backend/src/main/resources/db/migration | wc -l
find aza/src -name '*Screen.tsx' | wc -l

# Tests
find backend/src/test -name '*.java' | wc -l
find aza/src -name '*.test.ts*' | wc -l
ls aza/maestro/*.yaml | wc -l

# Schema dump for Appendix B
cat backend/src/main/resources/db/migration/*.sql > /tmp/aza-schema.sql

# OpenAPI spec for Appendix A
curl -s https://api.aza.systems/v3/api-docs | python3 -m json.tool > /tmp/aza-openapi.json

# Render Mermaid figures
npx -y @mermaid-js/mermaid-cli -i docs/thesis/04-system-architecture.md -o figures/arch.svg
```

## 15.6 Writing checklist

- [ ] Every **[FILL IN]** in these files is resolved or explicitly deferred in-text.
- [ ] Every ✘ in the competitive table (§12.6) is verified, with the date checked.
- [ ] The KYC tier figures carry the "placeholder, confirm against BoG" caveat.
- [ ] The regulatory-status position (§1.5) is stated unambiguously.
- [ ] Cryptographic claims state what is **not** achieved (no post-compromise security)
      alongside what is.
- [ ] Every code reference uses `path:line` and the line still points at what you claim.
- [ ] The concurrency experiment (§12.5) has been run, or its absence is stated.
- [ ] Figures are exported at print resolution and legible in greyscale.
- [ ] Secrets, tokens, keys and real customer data appear nowhere in the document or its
      screenshots — redact before you paste.
