# AZA — Thesis & Technical Documentation

This folder is the written record of the AZA platform, organised so it can be lifted
more or less directly into a thesis. Each file maps to one or more thesis chapters.

| File | Covers | Suggested thesis chapter |
|---|---|---|
| `01-introduction-background-methodology.md` | Ch. 1 problem, aims, objectives, scope, contributions · Ch. 2 domain background and literature · Ch. 3 development methodology, tooling, process | Ch. 1–3 |
| `02-architecture-and-backend.md` | Ch. 4 architecture, components, deployment topology · Ch. 5 domain model, data model, service layer, money invariants | Ch. 4–5 |
| `03-security-clients-and-platform.md` | Ch. 6 AuthN/AuthZ, E2EE protocol, risk & compliance · Ch. 7 React Native / Expo client · Ch. 8 the five Next.js surfaces · Ch. 9 Merchant API, Checkout, Connect, OAuth, Mini Apps | Ch. 6–9 |
| `04-operations-testing-and-results.md` | Ch. 10 CI/CD, containers, migrations, TLS, operations · Ch. 11 test strategy, coverage, evaluation method · Ch. 12 results, with tables to fill in | Ch. 10–12 |
| `05-limitations-glossary-and-appendices.md` | Ch. 13 limitations and roadmap · Ch. 14 glossary · Ch. 15 figures/tables to produce · **Ch. 16 two verification passes: 18 checks + 5 more, 10 findings, 9 fixed and covered by tests and 1 a deliberate withdrawal** | Ch. 13 · front matter · appendices |

Chapter and section numbers are unchanged from the earlier one-file-per-chapter layout, so
every `§` cross-reference in this folder and in any draft written against it still resolves.

## How to use this

1. Read `01-introduction-background-methodology.md` first, especially §1.6 (contributions) and §1.8 (organisation)
   — they tell you what your *argument* is, not just what you built. A thesis is judged on
   the argument.
2. Everything stated as fact here was read out of the repository on 2026-08-21 and
   **re-verified on 2026-09-06** against commit `9678fa5a`; every claim that could be checked
   mechanically *was* checked — see Ch. 16 in `05-limitations-glossary-and-appendices.md` for the commands and verdicts.

   The first pass produced five findings: F1 non-canonical lock ordering, F2 pre-commit
   external effects, F3 a vacuous invariant, F4 a mobile app that no longer typechecked
   (hiding two live runtime bugs), and F5 no mobile CI job at all. **All five are fixed and
   covered by tests.**

   The second pass produced five more: F6 three wallet writers that took no row lock, F7
   three money endpoints with no idempotency key, **F8 the deliberate withdrawal of
   end-to-end encryption for new chat messages**, F9 a deploy gate that printed its evidence
   without reading it, and F10 TURN credentials signed against a relay that was never
   running. Four are fixed; F8 is a trade, not a defect, and §12.4a argues it. The diagnosis
   is kept alongside each remedy, because the diagnosis is the part with thesis value.

2b. **Read §12.4a before anything else in the evaluation.** The system's most-cited security
   property — end-to-end encrypted chat — was built, deployed, and then withdrawn in favour
   of account-owned cross-device history. Any chapter you lift from an older draft that says
   "the server holds only ciphertext" is now false.
3. The remaining **[FILL IN]** markers are only things that require *your* measurement or
   *your* decision — performance figures, a usability study, the regulatory position,
   competitor verification. They are not gaps in the research; they are handoffs.
4. Code references use `path:line` form so you can cite exact locations in an appendix.
5. The first remediation is committed in seven reviewable slices on branch `Home` — §16.4
   maps each fix to its commit. Cite a hash rather than a description when you write up a
   fix. The second round is on `main`; the load-bearing hashes are `d35b9b59`
   (super-agent tier, closing F3), `a573783d` + `68894e13` + `c87c804c` (the E2EE
   withdrawal, F8), `4cec45d8` + `1b6d23b0` (locking and idempotency, F6/F7), `d853d9aa`
   (the deploy gate, F9) and `7a998b20` (coturn, F10).

## Working state at the second verification (`9678fa5a`, 2026-09-06)

| | | vs. 2026-08-21 |
|---|---|---|
| Backend | **509 tests, 0 failures** (53 classes; 7 Docker-gated integration tests skip locally) | +135 |
| Mobile | **326 tests, 0 failures** (24 suites); typecheck **0 errors** | +72 |
| Coverage — money classes | **61.7%** lines over 17 classes (**63.15%** over the original 13) | see §11.7 |
| Coverage — `src/crypto` | **87.75%** statements | flat |
| Money invariants holding unconditionally | **9 of 9** | +1 (F3 closed) |
| Flyway migrations | **62** (→ `V64`) | +5 |
| Deployables | **8** + the mini-app SDK | +1 |
| Working tree | clean | |

Those are the figures as measured in that pass. §1.7 of
`01-introduction-background-methodology.md` carries the current size and test counts,
re-measured at `af9601f5` (2026-09-08).

**One property moved backwards**, deliberately: user-to-user chat is no longer end-to-end
encrypted for new messages (§6.3.0, §12.4a). Bodies are encrypted at rest under a
server-held key so history follows the account rather than the device.

## One-paragraph description of the project (use this in your abstract)

AZA is a mobile-first digital financial services platform built for the Ghanaian market.
It combines a peer-to-peer e-money wallet, private chat with in-conversation payments and
voice/video calling, QR-based merchant acceptance, a two-tier agent cash-in/cash-out network
with master agents distributing float down a hierarchy, a merchant and partner API surface
(hosted checkout, marketplace splits, OAuth "Sign in with AZA"), and an embedded
mini-application hub — on a single ledger, under one compliance and risk framework. The
system is implemented as a Spring Boot 4 / PostgreSQL backend, a React Native (Expo) mobile
client, and five Next.js web surfaces, deployed as Docker
containers behind nginx with automated CI/CD. Correctness on the money path is governed by
nine written invariants, all of which are enforced by tests and mechanically re-verified.
