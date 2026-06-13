# @aza/miniapp-sdk

TypeScript SDK for building **Aza Mini Apps**.

The Aza native app injects `window.aza` into your WebView automatically — you don't ship any runtime code. This package gives you full TypeScript types and helpers so your IDE autocompletes correctly and your code is type-safe.

---

## Installation

```bash
npm install @aza/miniapp-sdk
# or
yarn add @aza/miniapp-sdk
```

---

## Quick start

```ts
import { waitForAza } from '@aza/miniapp-sdk';

const aza = await waitForAza();
const user = await aza.getUser();
console.log(`Hello, ${user.firstName}!`);
```

---

## API reference

### `waitForAza(timeoutMs?): Promise<AzaSDK>`

Resolves with the bridge once it is ready. Safe to call at any point — if the bridge is already injected it resolves immediately; otherwise it waits for the `azaReady` event (dispatched before your page's first script runs).

```ts
const aza = await waitForAza();   // default 5 s timeout
```

### `getAza(): AzaSDK`

Synchronous version. Throws `AzaNotAvailableError` if the bridge isn't present yet. Use `waitForAza()` unless you are certain the bridge is already available (e.g. inside an event handler that runs after `azaReady`).

### `isInsideAza(): boolean`

Returns `true` when running inside the Aza app. Use this to gracefully degrade when your app is also served standalone (useful during local development).

```ts
if (isInsideAza()) {
  const aza = getAza();
  // ...
} else {
  // show a "Open in Aza" banner
}
```

### `useAza(timeoutMs?): AzaHookState` *(React only)*

React hook version.

```tsx
import { useAza } from '@aza/miniapp-sdk';

function App() {
  const { status, aza } = useAza();

  if (status === 'loading')     return <Spinner />;
  if (status === 'unavailable') return <p>Please open this in Aza.</p>;

  return <button onClick={() => aza.close()}>Close</button>;
}
```

---

## `AzaSDK` methods

All methods return a `Promise` that rejects with an `Error` if the operation fails or the required permission was not granted.

### `aza.getUser() → Promise<AzaUser>`

Returns the authenticated user's profile. Always available once the user has given consent.

```ts
const user = await aza.getUser();
// { username, firstName, lastName, avatarUrl, phone?, email? }
```

`phone` and `email` are only present if your app declared `USER_PHONE` / `USER_EMAIL` in its permissions and the user approved them.

### `aza.getBalance() → Promise<AzaBalance>`

Returns the user's current wallet balance in GHS.

Requires: `READ_BALANCE` permission.

```ts
const { balance } = await aza.getBalance();
// { balance: 245.50 }
```

### `aza.requestPayment(params) → Promise<AzaPaymentResult>`

Shows a **native confirmation dialog** in Aza before any money moves. The Promise resolves only after the user taps "Confirm".

Requires: `MAKE_PAYMENTS` permission.

```ts
const result = await aza.requestPayment({
  amount: 5.00,
  recipientIdentifier: 'your_aza_username',  // your Aza account
  note: 'Premium subscription',
  idempotencyKey: crypto.randomUUID(),        // generate a fresh key per attempt
});
// { transactionId, status: 'COMPLETED', amount, recipientUsername, note }
```

**Important:** Generate a new `idempotencyKey` for every new payment intent. Reusing the same key on a retry is safe — Aza will return the original result without charging again.

### `aza.close() → Promise<void>`

Closes the mini app and returns the user to the Aza hub.

### `aza.share(options) → Promise<void>`

Opens the native Aza share sheet.

```ts
await aza.share({ title: 'Check this out', message: 'I just paid with Aza!' });
```

---

## Declaring permissions

Permissions must be declared when you submit your app via the Aza Developer dashboard. Users see them on a consent sheet on first launch.

| Permission key      | What it grants                                    |
|---------------------|---------------------------------------------------|
| `USER_PROFILE`      | name, username, avatar (always required)          |
| `USER_PHONE`        | phone number                                      |
| `USER_EMAIL`        | email address                                     |
| `MAKE_PAYMENTS`     | initiate payments from the user's Aza wallet      |
| `READ_BALANCE`      | read the user's wallet balance                    |
| `READ_TRANSACTIONS` | read recent transaction history *(coming soon)*   |

---

## Development

During local development `window.aza` is not available (no native bridge). Use `isInsideAza()` to detect this and show a fallback, or mock the bridge:

```ts
// dev-mock.ts  (never ship this to production)
if (process.env.NODE_ENV === 'development' && !window.aza) {
  window.aza = {
    version: 'mock',
    getUser:        async () => ({ username: 'testuser', firstName: 'Test', lastName: 'User', avatarUrl: null }),
    getBalance:     async () => ({ balance: 100.00 }),
    requestPayment: async (p) => ({ transactionId: 'mock-tx', status: 'COMPLETED', amount: p.amount, recipientUsername: p.recipientIdentifier, note: p.note ?? null }),
    close:          async () => {},
    share:          async () => {},
  };
}
```

---

## App URL requirements

- Must use **HTTPS**. HTTP URLs are rejected at submission time.
- Must be reachable from a mobile WebView (no localhost).
- Your server must not block WebView user agents.
