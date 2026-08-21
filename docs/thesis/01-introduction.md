# 1. Introduction

## 1.1 Background to the problem

Ghana's retail payments landscape is dominated by mobile money (MoMo) issued by mobile
network operators. That system solved reach — anyone with a SIM can hold value — but it
left three problems unsolved for the population that transacts most:

1. **Money movement is a separate act from the conversation that caused it.** People agree
   a payment in WhatsApp, switch to a USSD or MoMo app, transact, screenshot the receipt,
   and return to the chat. The context and the settlement live in different places, so
   disputes are resolved by screenshots.
2. **Interoperability is transaction-level, not product-level.** A merchant, a marketplace,
   or a developer who wants to *build on* the rails has to negotiate with each operator or
   go through an aggregator. There is no consumer-grade OAuth identity, no hosted checkout
   with marketplace splits, no embedded app surface.
3. **Trust is asserted, not demonstrated.** Consumers cannot verify a statement, a payment
   proof, or a merchant identity without a human intermediary.

AZA was built as an answer to all three at once: a wallet where the chat, the payment, the
merchant acceptance, the agent cash network and the developer platform are one system on
one ledger.

## 1.2 Statement of the problem

Existing digital financial services in Ghana treat messaging, payment, merchant acceptance
and third-party integration as separate, loosely-coupled products. This fragmentation
produces (a) poor user experience for everyday peer-to-peer settlement, (b) high
integration cost for merchants and developers, and (c) weak, non-verifiable audit trails
for consumers. No widely available platform in the market offers end-to-end encrypted
conversation and regulated e-money settlement within a single, auditable transactional
boundary.

## 1.3 Aim

To design, implement and evaluate an integrated, mobile-first digital financial services
platform that unifies encrypted messaging, peer-to-peer e-money transfer, merchant
acceptance, an agent cash network and a third-party developer platform, under a single
ledger with enforceable financial, security and regulatory invariants.

## 1.4 Objectives

1. **Design a domain and data model** for a multi-tenant e-money system that supports
   consumer wallets, merchant wallets, agent float wallets and platform (marketplace)
   balances without violating the safeguarding invariant that issued e-money equals
   safeguarded balance.
2. **Implement a transactional money engine** that guarantees balanced movement,
   idempotency, concurrency-safe balance updates, and a complete audit trail for every
   value movement.
3. **Implement end-to-end encryption** for chat and chat media using a modern asynchronous
   key-agreement protocol (X3DH) with forward secrecy, multi-device support and
   user-held, server-opaque backups.
4. **Build a compliance and risk layer** — tiered KYC, transaction limits, rule-based
   transaction monitoring (velocity, structuring, large-value), sanctions screening,
   maker–checker administrative controls and regulatory reporting.
5. **Expose a third-party platform surface** — API-key merchant APIs, hosted checkout,
   marketplace splits (AZA Connect), OAuth 2.0 + PKCE identity ("Sign in with AZA"),
   payment mandates, and a sandboxed mini-application runtime.
6. **Deliver production-grade delivery engineering** — schema migrations, containerised
   deployment, zero-downtime rollout, automated CI, and operational tooling.
7. **Evaluate** the resulting system against functional completeness, security properties,
   performance under concurrency, and conformance to the stated financial invariants.

## 1.5 Scope and delimitations

**In scope (v1, as implemented):**
- Ghana only; Ghanaian Cedi (GHS) only; single currency, no FX.
- Internal rails: value moves between AZA wallets. Cash enters and leaves through the
  agent network and manual/administered withdrawal flows.
- Consumer mobile app (iOS/Android via Expo), marketing + developer web, admin back
  office, merchant portal, hosted payment pages.
- Third-party integration by API key (server-to-server) and OAuth 2.0 (user-delegated).

**Explicitly out of scope:**
- Multi-currency and cross-border FX.
- Direct interconnection with MNO mobile-money switches or the national switch (GhIPSS)
  — the architecture accommodates it (see `Transaction.TransactionType`
  `PAYOUT`/`DISBURSEMENT`), but no live rail is integrated.
- Card acquiring/issuing.
- Formal regulatory licensing. The system implements controls modelled on Bank of Ghana
  e-money and KYC expectations; it is not a licensed EMI. **[FILL IN: state your
  institution's position on this clearly — it is the single most likely viva question.]**
- Formal cryptographic proof of the E2EE protocol. The implementation follows X3DH; a
  Double Ratchet (post-compromise security) is designed for but not implemented.

## 1.6 Significance / contribution

The contributions defensible in a thesis are:

1. **An integrated architecture** showing that encrypted messaging and regulated value
   transfer can share one transactional boundary, one identity, and one audit trail —
   with a concrete account of the invariants that makes it safe.
2. **A documented set of financial invariants** for a multi-actor e-money ledger (balanced
   movement, debit-before-external-effect, tenant-scoped idempotency, lock-based
   concurrency, maker–checker for administrative movement) and a review methodology that
   operationalises them (`.claude/skills/money-path-review/SKILL.md`).
3. **A practical multi-device E2EE design for a low-resource mobile context** — X3DH with
   per-device identities, consumed one-time pre-keys, per-file media keys, and a
   randomly-keyed (not PIN-derived) chat backup that is opaque to the server.
4. **A developer platform pattern for an African fintech** — hosted checkout with
   marketplace splits to non-merchant sellers, delegated payment mandates, and a
   sandboxed mini-app runtime with an explicit permission and consent model.
5. **An empirical engineering account** of building a system of this size
   (~220,000 lines across seven deployables) with the delivery controls that keep a money
   path safe over 57 schema migrations.

## 1.7 Scale of the artefact (measured 2026-08-21)

| Component | Language / stack | Size |
|---|---|---|
| Backend | Java 21, Spring Boot 4.0.6 | 61,330 LOC, 745 Java files |
| — controllers | | 113 |
| — services | | 100 |
| — JPA entities | | 105 |
| — repositories | | 109 |
| — DTOs | | 250 |
| — Flyway migrations | | 57 (V1 → V57) |
| — backend tests | JUnit 5 / Mockito / Testcontainers | 40 classes — **374 tests, all passing** |
| Mobile app | React Native 0.86 / Expo 57 / TS | 98,733 LOC, 387 files, 170 feature screens |
| — unit tests | Jest + RNTL | 17 suites, **254 tests, all passing** |
| — E2E flows | Maestro | 20 flows |
| `aza-web` (marketing + developer portal) | Next.js 16 | 15,922 LOC |
| `aza-admin` (back office) | Next.js 16 | 26,654 LOC |
| `aza-merchants` (merchant portal) | Next.js 16 | 15,512 LOC |
| `aza-pay` (hosted checkout) | Next.js 16 | 2,014 LOC |
| Mini apps + SDK | TypeScript | 7 reference apps + published SDK |
| **Total** | | **≈ 220,000 LOC** |

> Reproduce these numbers with:
> `find backend/src/main/java -name '*.java' | xargs wc -l | tail -1`
> `find aza/src \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1`
>
> Built over **694 commits between 14 March and 15 August 2026** by two principal
> contributors. Every quantitative claim in this documentation set was re-verified against
> the repository on 2026-08-21; the method and results are in `16-verification-log.md`.

## 1.8 Thesis organisation

- **Chapter 1** states the problem, aim, objectives and scope.
- **Chapter 2** reviews mobile money in Africa, e-money regulation, secure messaging
  protocols, and platform/API design; it establishes the gap.
- **Chapter 3** sets out the methodology: iterative delivery, the invariant-driven review
  process, and the evaluation design.
- **Chapter 4** presents the system architecture and data model.
- **Chapter 5** details the implementation: money engine, security and cryptography,
  clients, and the platform APIs.
- **Chapter 6** covers delivery engineering, testing and quality assurance.
- **Chapter 7** evaluates the system against the objectives.
- **Chapter 8** concludes with limitations and future work.
