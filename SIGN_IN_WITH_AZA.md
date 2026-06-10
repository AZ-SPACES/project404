# Sign in with AZA — Developer Guide

Allow your users to authenticate with their AZA account instead of creating a new password. Two flows are available: the **QR code flow** (great for desktop/TV/kiosk apps) and the **standard OAuth 2.0 PKCE flow** (great for web and mobile apps).

---

## Table of Contents

1. [Getting started](#1-getting-started)
2. [Scopes](#2-scopes)
3. [QR code login flow](#3-qr-code-login-flow)
4. [OAuth 2.0 PKCE flow](#4-oauth-20-pkce-flow)
5. [Token exchange](#5-token-exchange)
6. [Fetch user info](#6-fetch-user-info)
7. [Refresh tokens](#7-refresh-tokens)
8. [Revoking access](#8-revoking-access)
9. [API reference](#9-api-reference)
10. [Code examples](#10-code-examples)
11. [Security checklist](#11-security-checklist)

---

## 1. Getting started

### Register your app

Log in to AZA and go to **Settings → Developer → My Apps**, then click **Create App**. Or call the API directly if you have an AZA account:

```http
POST https://api.aza.systems/api/v1/developer/clients
Authorization: Bearer <your-aza-jwt>
Content-Type: application/json

{
  "appName": "Accra Travel",
  "appDescription": "Book flights and hotels across Africa",
  "logoUrl": "https://accratravel.com/logo.png",
  "websiteUrl": "https://accratravel.com",
  "redirectUris": ["https://accratravel.com/auth/callback"],
  "scopes": ["identity", "email"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "clientId": "aza_a1b2c3d4e5f6g7h8i9j0",
    "clientSecret": "3f9e2a1b4c8d7e6f5a4b3c2d1e0f9a8b",
    "appName": "Accra Travel",
    "redirectUris": ["https://accratravel.com/auth/callback"],
    "allowedScopes": ["identity", "email"],
    "createdAt": "2026-06-08T10:00:00"
  }
}
```

> **Store your `clientSecret` immediately.** It is shown only once. If you lose it, rotate it via `POST /api/v1/developer/clients/{clientId}/rotate-secret`.

---

## 2. Scopes

| Scope | What it grants |
|---|---|
| `identity` | Name, username, profile photo URL |
| `email` | Registered email address |
| `phone` | Registered phone number |
| `wallet:read` | Wallet balance and currency (read-only, no transaction history) |

Request only the scopes you need. Users see exactly what your app will access before they approve.

---

## 3. QR code login flow

Best for: desktop apps, smart TVs, kiosks, or any screen where the user cannot type a password.

The user scans a QR code with their AZA mobile app, reviews the permissions your app is requesting, and taps **Approve**. Your server then exchanges the session for an access token.

### Flow diagram

```
Your server                    AZA backend            AZA mobile app
    │                               │                       │
    │── POST /oauth/qr/initiate ───▶│                       │
    │◀── QR image + challengeToken ─│                       │
    │                               │                       │
    │  [show QR to user]            │                       │
    │                               │◀─ user scans QR ──────│
    │                               │◀─ user taps Approve ──│
    │                               │── sends approval ────▶│
    │                               │                       │
    │── GET /oauth/qr/status ──────▶│                       │
    │◀── { status: "APPROVED" } ────│                       │
    │                               │                       │
    │── POST /oauth/qr/complete ───▶│                       │
    │◀── access_token + refresh ────│                       │
```

### Step 1 — Initiate a QR session

```http
POST https://api.aza.systems/oauth/qr/initiate
Content-Type: application/json

{
  "clientId": "aza_a1b2c3d4e5f6g7h8i9j0",
  "clientSecret": "3f9e2a1b4c8d7e6f5a4b3c2d1e0f9a8b",
  "scopes": ["identity", "email"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "challengeToken": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "sessionSecret": "9b2c4a1d3e5f7a8b",
    "qrImageBase64": "iVBORw0KGgoAAAANS...",
    "expiresAt": "2026-06-08T10:01:30Z",
    "ttlSeconds": 90
  }
}
```

- `qrImageBase64` is a PNG image. Render it directly: `<img src="data:image/png;base64,{qrImageBase64}" />`
- Store `sessionSecret` server-side. **Never send it to the browser.** You will need it to complete the login.
- The QR expires in 90 seconds.

### Step 2 — Poll for status

Poll every 2–3 seconds until the status changes:

```http
GET https://api.aza.systems/oauth/qr/status/{challengeToken}
```

**Response:**

```json
{ "success": true, "data": { "status": "PENDING" } }
```

Status values:

| Value | Meaning |
|---|---|
| `PENDING` | Waiting for user to scan and approve |
| `APPROVED` | User approved — proceed to Step 3 immediately |
| `EXPIRED` | QR expired (90s timeout) — generate a new one |

### Step 3 — Complete and receive tokens

Once status is `APPROVED`, call complete from your **server** (never from the browser):

```http
POST https://api.aza.systems/oauth/qr/complete
Content-Type: application/json

{
  "challengeToken": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "sessionSecret": "9b2c4a1d3e5f7a8b",
  "clientId": "aza_a1b2c3d4e5f6g7h8i9j0",
  "clientSecret": "3f9e2a1b4c8d7e6f5a4b3c2d1e0f9a8b"
}
```

**Response:**

```json
{
  "access_token": "a1b2c3d4e5f6...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "z9y8x7w6v5u4...",
  "scope": "identity email"
}
```

The session is consumed atomically — replaying the same `challengeToken` returns an error.

---

## 4. OAuth 2.0 PKCE flow

Best for: web apps and mobile apps where the user is already in a browser.

### Step 1 — Generate PKCE values

```js
// Browser or your mobile app
const codeVerifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
const codeChallenge = btoa(
  String.fromCharCode(...new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  ))
).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
```

### Step 2 — Request an authorization URL

```http
POST https://api.aza.systems/oauth/authorize
Content-Type: application/json

{
  "clientId": "aza_a1b2c3d4e5f6g7h8i9j0",
  "redirectUri": "https://accratravel.com/auth/callback",
  "scope": "identity email",
  "state": "random-csrf-token",
  "codeChallenge": "<computed above>",
  "codeChallengeMethod": "S256"
}
```

**Response:**

```json
{
  "success": true,
  "data": "https://aza.systems/oauth/consent?state=abc123"
}
```

### Step 3 — Redirect the user

Redirect the user's browser to the returned URL. AZA will show them a consent screen with your app name, logo, and the permissions you requested.

### Step 4 — Handle the callback

After approval, AZA redirects to your `redirectUri`:

```
https://accratravel.com/auth/callback?code=abc123xyz&state=random-csrf-token
```

Verify `state` matches what you sent (CSRF protection), then exchange the code for tokens.

### Step 5 — Exchange the code for tokens

**This must happen server-side**, never in the browser:

```http
POST https://api.aza.systems/oauth/token
Content-Type: application/json

{
  "grantType": "authorization_code",
  "code": "abc123xyz",
  "redirectUri": "https://accratravel.com/auth/callback",
  "codeVerifier": "<the verifier from Step 1>",
  "clientId": "aza_a1b2c3d4e5f6g7h8i9j0",
  "clientSecret": "3f9e2a1b4c8d7e6f5a4b3c2d1e0f9a8b"
}
```

Response is the same token object as the QR flow.

---

## 5. Token exchange

Both flows return the same token object:

```json
{
  "access_token": "a1b2c3d4e5f6...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "z9y8x7w6v5u4...",
  "scope": "identity email"
}
```

| Field | Description |
|---|---|
| `access_token` | Present this in the `Authorization` header to call AZA APIs |
| `expires_in` | Seconds until the access token expires (3600 = 1 hour) |
| `refresh_token` | Use this to get a new access token without user interaction (30 day TTL) |

---

## 6. Fetch user info

```http
GET https://api.aza.systems/oauth/userinfo
Authorization: Bearer <access_token>
```

**Response** (fields present only if the scope was approved):

```json
{
  "sub": "3f9e2a1b-4c8d-7e6f-5a4b-3c2d1e0f9a8b",
  "name": "Kwame Mensah",
  "username": "kwame",
  "picture": "https://cdn.aza.systems/avatars/kwame.jpg",
  "email": "kwame@example.com",
  "phone": "+233201234567",
  "wallet_balance": "1250.00",
  "wallet_currency": "GHS"
}
```

| Field | Scope required |
|---|---|
| `sub` | Always present (AZA user UUID) |
| `name`, `username`, `picture` | `identity` |
| `email` | `email` |
| `phone` | `phone` |
| `wallet_balance`, `wallet_currency` | `wallet:read` |

---

## 7. Refresh tokens

When the access token expires, use the refresh token to get a new pair without user interaction:

```http
POST https://api.aza.systems/oauth/token
Content-Type: application/json

{
  "grantType": "refresh_token",
  "refreshToken": "z9y8x7w6v5u4...",
  "clientId": "aza_a1b2c3d4e5f6g7h8i9j0",
  "clientSecret": "3f9e2a1b4c8d7e6f5a4b3c2d1e0f9a8b"
}
```

The old refresh token is revoked and a new pair is returned. Refresh tokens are valid for **30 days**.

---

## 8. Revoking access

To revoke a specific token:

```http
POST https://api.aza.systems/oauth/revoke?clientId=aza_...&clientSecret=...&token=<access_or_refresh_token>
```

Users can also revoke your app's access at any time from **AZA Settings → Privacy → Connected Apps**.

---

## 9. API reference

### Base URL

```
https://api.aza.systems
```

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/oauth/clients/{clientId}` | None | Get public app info (for mobile consent display) |
| `POST` | `/oauth/authorize` | None | Initiate PKCE consent flow |
| `POST` | `/oauth/token` | client_id + client_secret | Exchange code or refresh token |
| `GET` | `/oauth/userinfo` | Bearer token | Get user profile |
| `POST` | `/oauth/revoke` | client_id + client_secret | Revoke a token |
| `POST` | `/oauth/qr/initiate` | client_id + client_secret | Start a QR login session |
| `GET` | `/oauth/qr/status/{token}` | None | Poll QR session status |
| `POST` | `/oauth/qr/complete` | client_id + client_secret | Complete QR login and get tokens |
| `POST` | `/api/v1/developer/clients` | AZA JWT | Register an OAuth app |
| `GET` | `/api/v1/developer/clients` | AZA JWT | List your apps |
| `GET` | `/api/v1/developer/clients/{id}` | AZA JWT | Get app details |
| `POST` | `/api/v1/developer/clients/{id}/rotate-secret` | AZA JWT | Rotate client secret |
| `DELETE` | `/api/v1/developer/clients/{id}` | AZA JWT | Deactivate an app |

### Error format

All errors return standard HTTP status codes with a JSON body:

```json
{
  "success": false,
  "error": {
    "code": "OAUTH_INVALID_CLIENT",
    "message": "Invalid client credentials."
  }
}
```

Common error codes:

| Code | HTTP | Meaning |
|---|---|---|
| `OAUTH_INVALID_CLIENT` | 401 | Wrong `clientId` or `clientSecret` |
| `OAUTH_INVALID_CODE` | 400 | Auth code is expired or already used |
| `OAUTH_PKCE_FAILED` | 400 | `code_verifier` doesn't match `code_challenge` |
| `OAUTH_SCOPE_NOT_ALLOWED` | 400 | Requested scope not registered for this client |
| `OAUTH_INVALID_REDIRECT` | 400 | `redirect_uri` not registered |
| `OAUTH_TOKEN_EXPIRED` | 401 | Access token expired — use refresh token |
| `OAUTH_INVALID_REFRESH` | 401 | Refresh token expired or already used |
| `QR_EXPIRED` | 410 | QR session expired or already consumed |
| `QR_NOT_APPROVED` | 403 | QR session not yet approved by user |

---

## 10. Code examples

### Node.js — QR login (Express)

```js
const express = require('express');
const axios   = require('axios');
const app     = express();
app.use(express.json());

const AZA_API      = 'https://api.aza.systems';
const CLIENT_ID     = process.env.AZA_CLIENT_ID;
const CLIENT_SECRET = process.env.AZA_CLIENT_SECRET;

// Map challengeToken → sessionSecret (use Redis in production)
const sessions = new Map();

// 1. Show a QR code
app.get('/login', async (req, res) => {
  const { data } = await axios.post(`${AZA_API}/oauth/qr/initiate`, {
    clientId:     CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    scopes:       ['identity', 'email'],
  });

  const { challengeToken, sessionSecret, qrImageBase64, ttlSeconds } = data.data;
  sessions.set(challengeToken, sessionSecret);
  setTimeout(() => sessions.delete(challengeToken), ttlSeconds * 1000);

  res.send(`
    <img src="data:image/png;base64,${qrImageBase64}" width="250" />
    <script>
      (async () => {
        for (let i = 0; i < 45; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const r = await fetch('/poll/${challengeToken}');
          const { done, redirect } = await r.json();
          if (done) { window.location = redirect; break; }
        }
      })();
    </script>
  `);
});

// 2. Poll status (called by browser JS)
app.get('/poll/:token', async (req, res) => {
  const { token } = req.params;
  const { data }  = await axios.get(`${AZA_API}/oauth/qr/status/${token}`);

  if (data.data.status === 'APPROVED') {
    const sessionSecret = sessions.get(token);
    const { data: tokens } = await axios.post(`${AZA_API}/oauth/qr/complete`, {
      challengeToken: token,
      sessionSecret,
      clientId:     CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    // Store tokens in your session (e.g. req.session.azaTokens = tokens)
    sessions.delete(token);
    return res.json({ done: true, redirect: '/dashboard' });
  }

  res.json({ done: false });
});

// 3. Fetch user info with the token
app.get('/dashboard', async (req, res) => {
  // Assume you stored access_token in req.session
  const accessToken = req.session?.azaTokens?.access_token;
  const { data: user } = await axios.get(`${AZA_API}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  res.json(user);
});

app.listen(3000);
```

### Python — PKCE flow (Flask)

```python
import os, secrets, hashlib, base64, requests
from flask import Flask, redirect, request, session, jsonify

app    = Flask(__name__)
app.secret_key = secrets.token_hex(32)

AZA_API      = 'https://api.aza.systems'
CLIENT_ID    = os.environ['AZA_CLIENT_ID']
CLIENT_SECRET= os.environ['AZA_CLIENT_SECRET']
REDIRECT_URI = 'https://myapp.com/auth/callback'

@app.route('/login')
def login():
    verifier  = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b'=').decode()
    state = secrets.token_urlsafe(16)

    session['verifier'] = verifier
    session['state']    = state

    r = requests.post(f'{AZA_API}/oauth/authorize', json={
        'clientId':            CLIENT_ID,
        'redirectUri':         REDIRECT_URI,
        'scope':               'identity email',
        'state':               state,
        'codeChallenge':       challenge,
        'codeChallengeMethod': 'S256',
    })
    consent_url = r.json()['data']
    return redirect(consent_url)

@app.route('/auth/callback')
def callback():
    if request.args.get('state') != session.pop('state', None):
        return 'State mismatch', 400

    r = requests.post(f'{AZA_API}/oauth/token', json={
        'grantType':    'authorization_code',
        'code':         request.args['code'],
        'redirectUri':  REDIRECT_URI,
        'codeVerifier': session.pop('verifier'),
        'clientId':     CLIENT_ID,
        'clientSecret': CLIENT_SECRET,
    })
    tokens = r.json()
    session['access_token'] = tokens['access_token']
    return redirect('/dashboard')

@app.route('/dashboard')
def dashboard():
    r = requests.get(f'{AZA_API}/oauth/userinfo',
        headers={'Authorization': f"Bearer {session['access_token']}"})
    return jsonify(r.json())
```

### cURL — Quick test

```bash
# 1. Start a QR session
curl -X POST https://api.aza.systems/oauth/qr/initiate \
  -H "Content-Type: application/json" \
  -d '{"clientId":"aza_...","clientSecret":"...","scopes":["identity"]}'

# 2. Poll status
curl https://api.aza.systems/oauth/qr/status/<challengeToken>

# 3. Complete (once APPROVED)
curl -X POST https://api.aza.systems/oauth/qr/complete \
  -H "Content-Type: application/json" \
  -d '{"challengeToken":"...","sessionSecret":"...","clientId":"aza_...","clientSecret":"..."}'

# 4. Fetch user info
curl https://api.aza.systems/oauth/userinfo \
  -H "Authorization: Bearer <access_token>"
```

---

## 11. Security checklist

- **Never expose `clientSecret` in browser code or mobile apps.** Token exchange and QR completion must happen server-to-server.
- **Always verify `state`** in the PKCE callback to prevent CSRF attacks.
- **Use PKCE** even if you also send `clientSecret` — defense in depth.
- **Store tokens securely** — use `HttpOnly` cookies or encrypted server-side storage, not `localStorage`.
- **Register only the exact redirect URIs** your app uses. Do not use wildcards.
- **Request only the scopes you need.** Fewer permissions = more user trust.
- **Rotate your `clientSecret`** immediately if you suspect it has been exposed.
- **Handle token expiry** gracefully with the refresh token flow rather than prompting users to log in again.

---

*For questions or integration support, contact developers@aza.systems*
