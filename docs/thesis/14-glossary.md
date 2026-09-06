# 14. Glossary and Abbreviations

## Project terms

| Term | Meaning |
|---|---|
| **AZA** | The platform. Also the brand; the mobile app, backend and web surfaces all carry it. |
| **Akyede** | Ghanaian gifting feature (Akan *akyɛdeɛ*, "gift") — a red-envelope style money gift with expiry back to the sender. |
| **AZA Connect** | Marketplace product: one KYB'd platform pays many non-merchant sellers, by checkout split or direct transfer. |
| **AZA Pay** | The hosted checkout and mandate-approval surface at `pay.aza.systems`. |
| **Handle** | A user's `@username`; the primary human-readable payment address. |
| **Hold** | A checkout payment that does not settle at confirmation but waits for the integrator to call `release`. `release: AUTOMATIC \| MANUAL`. |
| **Mini App** | Third-party web app embedded in the AZA client's WebView via the `window.aza` bridge. |
| **Money request** | An in-chat request for payment. Settled as an ordinary transfer, so it is limit-checked identically. |
| **Netting / settle-up** | Collapsing several debts between two people into one request. |
| **Recipient invite** | A transfer addressed to someone with no AZA account, claimable on signup. |
| **Split** | A shared expense divided (equally or by weight) into per-participant money requests. |
| **Terminal ID** | Free-form label on a store QR identifying the till, branch or cashier. AZA stores and echoes it but never interprets it. |

## Domain terms

| Term | Meaning |
|---|---|
| **AML / CFT** | Anti-Money Laundering / Countering the Financing of Terrorism. |
| **BoG** | Bank of Ghana — the central bank and payments regulator. |
| **bps** | Basis points; 1 bp = 0.01%. Used for agent commission and merchant fee rates. |
| **Cash-in / cash-out** | Converting physical cash to wallet balance and back, via an agent. |
| **E-money** | Stored monetary value issued against received funds, redeemable at par. |
| **Float** | Liquidity an agent holds to serve cash-in and cash-out. |
| **Float distribution / recall** | A master agent pushing float down to a sub-agent, or pulling idle float back up. An internal `AGENT_FLOAT`→`AGENT_FLOAT` move: no e-money is created, and no margin is taken (invariant 8). |
| **GHS** | Ghanaian Cedi — the only currency AZA supports in v1. |
| **GhIPSS** | Ghana Interbank Payment and Settlement Systems. |
| **KYB** | Know Your Business — identity verification for a merchant. |
| **KYC** | Know Your Customer — identity verification for an individual. |
| **Maker–checker** | Dual control: the initiator of a privileged action cannot approve it. |
| **MDR** | Merchant Discount Rate — the fee a merchant pays on an accepted payment. |
| **Pricing plan** | The class of merchant pricing a fee rule applies to (`STANDARD`, …). Lets one versioned rule price a whole class of merchants; `merchants.fee_rate_bps` remains a per-merchant override that outranks the plan (V62). |
| **MNO** | Mobile Network Operator. |
| **MoMo** | Mobile Money — the MNO-issued e-money products dominant in Ghana. |
| **PEP** | Politically Exposed Person — a category attracting enhanced due diligence. |
| **Safeguarding** | Holding customer funds so that issued e-money is fully backed by segregated funds. |
| **Structuring / smurfing** | Splitting a large transfer into several smaller ones to stay under a reporting threshold. |
| **Super agent / master agent** | An agent of tier `SUPER` holding float and distributing it to the standard agents beneath it. Sub-agents are set at creation and cannot be re-parented (V58). |
| **Tiered KYC** | Graduated identity requirements with graduated limits. |
| **Velocity rule** | A monitoring rule on the count or value of transactions in a rolling window. |

## Technical terms

| Term | Meaning |
|---|---|
| **AAD** | Additional Authenticated Data — authenticated but not encrypted by AEAD; binds a ciphertext to its context. |
| **AEAD** | Authenticated Encryption with Associated Data (here, AES-256-GCM). |
| **Base32 (Crockford)** | 32-symbol encoding excluding I, L, O, U; used for the backup recovery key. |
| **BCrypt** | Adaptive password-hashing function. |
| **Double Ratchet** | Continuous key-ratcheting protocol providing post-compromise security. *Designed for, not implemented.* |
| **ECDH** | Elliptic-Curve Diffie–Hellman key agreement. |
| **Ed25519** | EdDSA signature scheme on Curve25519; used to sign pre-keys. |
| **E2EE** | End-to-End Encryption. In AZA this describes chat history sent **before 2026-09-02**; new messages are encrypted at rest under a server-held key instead (§6.3.0). |
| **Encryption at rest** | Data encrypted where it is stored, under a key the *operator* holds. Defends a stolen dump or backup; does not defend against the operator. Distinct from E2EE, and the distinction is load-bearing throughout Ch. 6 and 12. |
| **Flyway** | Versioned database migration tool. |
| **Forward secrecy** | Compromise of long-term keys does not expose past messages. |
| **HKDF** | HMAC-based Key Derivation Function (RFC 5869). |
| **HMAC** | Hash-based Message Authentication Code. |
| **HSTS** | HTTP Strict Transport Security. |
| **Idempotency key** | Client-supplied token making a repeated request safe to replay. |
| **IK / SPK / OPK / EK** | Identity Key / Signed Pre-Key / One-Time Pre-Key / Ephemeral Key. |
| **JPA / Hibernate** | Java Persistence API and its reference implementation. |
| **JWT** | JSON Web Token. |
| **OAuth 2.0 / PKCE** | Delegated authorisation framework / Proof Key for Code Exchange (RFC 7636). |
| **Pessimistic lock** | `SELECT … FOR UPDATE`; serialises concurrent access to a row. |
| **Read-modify-write race** | Two transactions read the same value, each computes from it, and one write is lost. The defect a pessimistic lock prevents, and the one three wallet writers were exposed to until `WalletLedger` (§5.4a). |
| **Post-compromise security** | Sessions self-heal after a key compromise ends. |
| **Safety number** | A hash of both parties' identity keys, compared out of band to detect a MITM. |
| **Redis Stream** | An append-only log with per-entry ids. Backs `WebSocketEventLog`, the durable per-user recovery log behind the live pub/sub transport (§4.5). |
| **At-least-once delivery** | A replayed event may arrive twice, so consumers dedupe on id. The delivery guarantee of the event log. |
| **STOMP** | Simple Text Oriented Messaging Protocol; here over WebSocket. |
| **WatchConnectivity / application context** | Apple's phone↔watch transport, and its latest-value-wins primitive. Carries the wallet snapshot to the watch; chosen over `transferUserInfo` and `sendMessage` (§7.7). |
| **App Group** | A shared container letting an app and its extensions on **one device** exchange data. How the watch app hands snapshots to its WidgetKit complications, which run in a separate process. |
| **WidgetKit complication** | A watch-face element rendered by a separate extension process. |
| **TOTP** | Time-based One-Time Password (RFC 6238). |
| **coturn** | The TURN/STUN server implementation AZA runs, as a host service on the droplet. |
| **CGNAT** | Carrier-Grade NAT — many subscribers sharing one public IP. Why unauthenticated rate limits key on device before IP (§6.4), and why a TURN relay is required for calls (§4.5). |
| **Symmetric NAT** | A NAT that maps each destination to a different external port, defeating the hole-punching that lets two peers connect directly. Common on mobile carriers; the reason TURN is not optional. |
| **TURN** | Traversal Using Relays around NAT; relays WebRTC media when P2P fails. |
| **WebRTC** | Real-time peer-to-peer audio/video in the browser and on mobile. |
| **X25519** | ECDH function on Curve25519 (RFC 7748). |
| **X3DH** | Extended Triple Diffie-Hellman — asynchronous key agreement. |

## Technology versions (as at 2026-09-06)

| Component | Version |
|---|---|
| Java | 21 (Temurin) |
| Spring Boot | 4.0.6 |
| PostgreSQL | 16 |
| Redis | 7 (alpine) |
| Flyway | via `spring-boot-flyway` + `flyway-database-postgresql` |
| springdoc-openapi | 3.0.3 (must stay on 3.0.x for Boot 4) |
| jjwt | 0.12.6 |
| Firebase Admin | 9.3.0 |
| Cloudinary | 2.3.2 (http5) |
| AWS SDK S3 | 2.25.60 |
| React Native | 0.86.0 |
| Expo SDK | 57 |
| React | 19.2.x |
| Next.js | 16.2.6 |
| Tailwind CSS | 4 |
| TypeScript | 6.0.x (mobile), 5.x (web) |
| Node (CI) | 22 |
| `@noble/curves` / `ciphers` / `hashes` | 2.2.0 |
