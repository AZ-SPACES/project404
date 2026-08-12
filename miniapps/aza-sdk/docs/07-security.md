# Security Requirements

Mini apps run in a sandboxed WebView. Aza enforces strict security rules — violating them will cause your app to be rejected or suspended.

---

## HTTPS is mandatory

All mini app URLs must use `https://`. HTTP is rejected at submission time and blocked in the WebView.

This means:
- Your hosting must have a valid TLS certificate
- All resources loaded by your app (images, scripts, fonts, APIs) must also be HTTPS
- No mixed content — a single `http://` asset will trigger a browser security warning

---

## Content Security Policy

Set a `Content-Security-Policy` header on your server. A good baseline:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.aza.systems;
  frame-ancestors 'none';
```

**Do not use `unsafe-eval`** — it enables code injection attacks and is grounds for rejection.

For Vite/React, inline scripts are needed for the entry point. Use a nonce or hash instead of `'unsafe-inline'` for `script-src` in production:

```
script-src 'self' 'nonce-RANDOM_NONCE_HERE';
```

---

## What NOT to do

### Don't intercept or override `window.aza`

The bridge is injected by Aza before your page loads. Any attempt to overwrite, proxy, or intercept `window.aza` is a security violation and will result in suspension.

```ts
// ❌ Never do this in production
window.aza = myCustomObject;
Object.defineProperty(window, 'aza', { ... });
```

The only legitimate use of `window.aza = ...` is in development mocks (which must not be present in production builds).

### Don't exfiltrate user data

Data returned by `aza.getUser()` belongs to the user. Rules:
- Store only what you need
- Don't sell or share user data with third parties
- Don't log raw user objects to third-party analytics services
- Disclose data usage in your privacy policy

### Don't fake payment UIs

Never show a UI that looks like an Aza payment confirmation but isn't. All payments must go through `aza.requestPayment()` — which shows the native dialog. Creating a fake payment flow is a permanent ban.

### Don't request unnecessary permissions

Requesting `MAKE_PAYMENTS` in a read-only app, or `READ_BALANCE` in an app that never shows a balance, is a red flag during review and will be rejected.

### Don't load untrusted scripts

Avoid loading JavaScript from CDNs you don't control, especially if they can be compromised (e.g. unpinned CDN URLs). If you load third-party scripts, use Subresource Integrity (SRI):

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-HASH_HERE"
  crossorigin="anonymous"
></script>
```

---

## iframe restrictions

The Aza WebView disallows iframes that load third-party pages. Your app can use iframes for your own content (same origin), but cannot embed external sites.

This means payment gateways or third-party auth flows that rely on iframes won't work inside a mini app. Use redirects or popups instead, or use `aza.requestPayment()` for all payments.

---

## Storage limits

The WebView sandbox has storage limits:

| Storage | Limit | Notes |
|---------|-------|-------|
| `localStorage` | 5 MB | Persists across sessions |
| `sessionStorage` | 5 MB | Cleared when app closes |
| `IndexedDB` | ~50 MB | Best for large structured data |
| Cookies | 4 KB per cookie | Available but prefer Web Storage |

Don't store sensitive data (tokens, PII) in `localStorage` — prefer session-scoped storage or your own backend.

---

## Rate limiting

The SDK bridge has per-app rate limits:

| Method | Limit |
|--------|-------|
| `getUser` | 30 calls/minute |
| `getBalance` | 10 calls/minute |
| `requestPayment` | 5 calls/minute |

Cache results where possible rather than calling on every render:

```ts
// Good — fetch once, cache in state
const [user, setUser] = useState<AzaUser | null>(null);
useEffect(() => {
  waitForAza().then(aza => aza.getUser()).then(setUser);
}, []);

// Bad — calls getUser on every render
function Component() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    getAza().getUser().then(setUser);
  }); // no dependency array — runs every render
}
```

---

## Reporting vulnerabilities

If you discover a security issue in the Aza mini app platform, report it to **security@aza.systems** before disclosing publicly. Do not exploit vulnerabilities for personal gain — this includes testing payment flows with real money beyond what is needed for verification.
