# Aza Backend

Spring Boot backend for the Aza fintech application. Handles authentication, KYC, wallet transactions, real-time chat, peer-to-peer calls, and push notifications.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Java 21 |
| Framework | Spring Boot 4.0.6 |
| Auth | Spring Security, JWT (HMAC-SHA256), TOTP 2FA |
| Database | PostgreSQL (JPA/Hibernate) |
| Cache / Pub-Sub | Redis |
| WebSocket | STOMP over WebSocket, Redis Pub/Sub |
| Push | Firebase Cloud Messaging (FCM) |
| Media | Cloudinary |
| SMS | Arkesel |
| Email | Gmail SMTP |
| API Docs | SpringDoc OpenAPI (Swagger) |

## Prerequisites

- JDK 21
- Maven 3.x (or use the included `./mvnw` wrapper)
- PostgreSQL
- Redis
- Docker (optional — `docker-compose.yml` included for local Postgres + Redis)

## Setup

### 1. Clone and enter the directory

```bash
git clone <repository-url>
cd backend
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in every value. The required variables are:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | HS256 signing key — minimum 64 characters |
| `DB_URL` | JDBC URL, e.g. `jdbc:postgresql://localhost:5432/aza` |
| `DB_USERNAME` | PostgreSQL username |
| `DB_PASSWORD` | PostgreSQL password |
| `REDIS_HOST` | Redis hostname |
| `REDIS_PORT` | Redis port (default `6379`) |
| `REDIS_PASSWORD` | Redis password (leave blank if none) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `ARKESEL_API_KEY` | Arkesel SMS API key |
| `ARKESEL_SENDER_ID` | Arkesel sender ID |
| `GMAIL_USERNAME` | Gmail address for outbound email |
| `GMAIL_APP_PASSWORD` | Gmail app password |
| `TURN_SECRET` | HMAC secret for TURN server credential generation (required) |
| `TURN_HOST` | TURN server hostname, e.g. `turn.yourdomain.com` |
| `TRUSTED_PROXY_IPS` | Comma-separated IPs of trusted reverse proxies (blank for local dev) |

> `TURN_SECRET` has no default — the application will refuse to start if it is unset.

### 3. Start dependencies (optional)

```bash
docker-compose up -d
```

### 4. Run

```bash
./mvnw spring-boot:run
```

## API Documentation

Swagger UI is available at `http://localhost:8080/swagger-ui/index.html` (requires authentication).

## Project Structure

```
com.aza.backend
├── config/          # Spring configuration (Redis, WebSocket, Security, Firebase)
├── controller/      # REST endpoints
├── dto/             # Request / response DTOs
├── entity/          # JPA entities
├── exception/       # Global exception handling
├── repository/      # Spring Data JPA repositories
├── security/        # JWT filter and utilities
├── service/         # Business logic
├── util/            # Email, SMS, Cloudinary, rate-limit helpers
└── websocket/       # STOMP handlers, Redis subscriber, WebSocket interceptor
```

## Features

- **Authentication** — OTP login, TOTP 2FA, biometric tokens, recovery codes, refresh tokens
- **End-to-End Encryption** — Signal-style key bundle exchange (identity key, signed pre-key, one-time pre-keys)
- **Wallet & Transfers** — Peer-to-peer transfers with idempotency keys, daily/single-amount limits, passcode confirmation
- **Payment Requests** — In-chat payment requests with approval/decline flows, enforcing the same transfer limits
- **Real-time Chat** — STOMP over WebSocket with Redis Pub/Sub for multi-instance delivery; disappearing messages, view-once media, message editing, typing indicators
- **Calls** — WebRTC signalling (SDP/ICE relay), voice-to-video upgrade, reconnection, TURN credential generation
- **KYC** — Identity verification, PEP screening, source-of-funds declaration
- **Contacts** — Phone-number-based contact sync with blocking support
- **Notifications** — FCM push + in-app WebSocket notifications with silent-hours support
- **Rate Limiting** — Per-IP and per-user limits on sensitive endpoints via atomic Redis Lua scripts

## Security Notes

- JWT tokens use HS256 with a minimum 64-character secret and are blacklisted in Redis on logout.
- TOTP secrets are AES-256-GCM encrypted at rest with per-secret random IVs.
- Biometric tokens are SHA-256 hashed before storage.
- Financial transfers use pessimistic wallet locks (`SELECT ... FOR UPDATE`) and payment requests use optimistic locking (`@Version`) to prevent double-spend.
- Chat WebSocket events are delivered to per-user private queues (`/user/queue/chat`) — not broadcast topics.
- `X-Forwarded-For` is only trusted when the direct connection comes from a configured `TRUSTED_PROXY_IPS` address.
- OTP purpose values are validated against an allowlist (`login`, `signup`, `password_reset`).
