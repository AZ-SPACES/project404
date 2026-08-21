# AZA — Thesis & Technical Documentation

This folder is the written record of the AZA platform, organised so it can be lifted
more or less directly into a thesis. Each file maps to one or more thesis chapters.

| File | Covers | Suggested thesis chapter |
|---|---|---|
| `01-introduction.md` | Problem, motivation, aims, objectives, scope, contributions | Ch. 1 |
| `02-background.md` | Domain background and the literature you need to cite | Ch. 2 |
| `03-methodology.md` | Development methodology, tooling, process | Ch. 3 |
| `04-system-architecture.md` | Overall architecture, components, deployment topology | Ch. 4 |
| `05-backend-design.md` | Domain model, data model, service layer, money invariants | Ch. 4/5 |
| `06-security-and-cryptography.md` | AuthN/AuthZ, E2EE protocol, risk & compliance controls | Ch. 5 |
| `07-mobile-application.md` | React Native / Expo client design | Ch. 5 |
| `08-web-applications.md` | The four Next.js surfaces | Ch. 5 |
| `09-platform-apis.md` | Merchant API, Checkout, Connect, OAuth, Mini Apps | Ch. 5 |
| `10-devops-and-deployment.md` | CI/CD, containers, migrations, TLS, operations | Ch. 6 |
| `11-testing-and-quality.md` | Test strategy, coverage, evaluation method | Ch. 6 |
| `12-results-and-evaluation.md` | What to measure, with tables to fill in | Ch. 7 |
| `13-limitations-and-future-work.md` | Honest gaps and the roadmap | Ch. 8 |
| `14-glossary.md` | Terms, acronyms, abbreviations | Front matter |
| `15-figures-and-tables.md` | Every diagram/table you should draw, with source data | Appendix |
| `16-verification-log.md` | **18 mechanical checks with commands and verdicts — 5 findings, 4 of them fixed and covered by tests** | Appendix / Ch. 7 |

## How to use this

1. Read `01-introduction.md` first, especially §1.6 (contributions) and §1.8 (organisation)
   — they tell you what your *argument* is, not just what you built. A thesis is judged on
   the argument.
2. Everything stated as fact here was read out of the repository on 2026-08-21, and every
   claim that could be checked mechanically *was* checked — see `16-verification-log.md` for
   the commands and verdicts. Five findings came out of that pass: F1 non-canonical lock
   ordering, F2 pre-commit external effects, F3 a vacuous invariant, F4 a mobile app that no
   longer typechecked (hiding two live runtime bugs), and F5 no mobile CI job at all.
   **Four have been fixed and are now covered by tests**; the diagnosis is kept alongside
   each remedy, because the diagnosis is the part with thesis value.
3. The remaining **[FILL IN]** markers are only things that require *your* measurement or
   *your* decision — performance figures, a usability study, the regulatory position,
   competitor verification. They are not gaps in the research; they are handoffs.
4. Code references use `path:line` form so you can cite exact locations in an appendix.

## One-paragraph description of the project (use this in your abstract)

AZA is a mobile-first digital financial services platform built for the Ghanaian market.
It combines a peer-to-peer e-money wallet, end-to-end encrypted chat with in-conversation
payments, QR-based merchant acceptance, an agent cash-in/cash-out network, a merchant and
partner API surface (hosted checkout, marketplace splits, OAuth "Sign in with AZA"), and
an embedded mini-application hub — on a single ledger, under one compliance and risk
framework. The system is implemented as a Spring Boot 4 / PostgreSQL backend, a React
Native (Expo) mobile client, and four Next.js web surfaces, deployed as Docker containers
behind nginx with automated CI/CD.
