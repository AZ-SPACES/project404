# SDK Reference

Install:
```bash
npm install @az-spaces/aza-miniapp-sdk
```

---

## Entry points

### `waitForAza(timeoutMs?): Promise<AzaSDK>`

The standard way to access the bridge. Resolves immediately if `window.aza` is already set; otherwise waits for the `azaReady` event which fires before your page's first script runs.

```ts
import { waitForAza } from '@az-spaces/aza-miniapp-sdk';

const aza = await waitForAza();        // default 5 000 ms timeout
const aza = await waitForAza(10_000); // custom timeout
```

Rejects with `AzaNotAvailableError` if the bridge doesn't appear within `timeoutMs`.

---

### `getAza(): AzaSDK`

Synchronous. Throws `AzaNotAvailableError` if the bridge isn't present.

Use this only inside callbacks/handlers that you know run after the bridge is ready — e.g. inside a button `onClick` after you've already awaited `waitForAza()`.

```ts
button.addEventListener('click', () => {
  const aza = getAza(); // safe — bridge is definitely ready by now
  aza.close();
});
```

---

### `isInsideAza(): boolean`

Returns `true` when running inside the Aza WebView. Use this to show a fallback UI when your app is opened in a regular browser.

```ts
if (!isInsideAza()) {
  document.body.innerHTML = '<p>Please open this app in Aza.</p>';
}
```

---

### `useAza(timeoutMs?): AzaHookState` *(React)*

React hook. Returns one of three states:

```ts
type AzaHookState =
  | { status: 'loading' }
  | { status: 'ready'; aza: AzaSDK }
  | { status: 'unavailable'; error: AzaNotAvailableError };
```

```tsx
import { useAza } from '@az-spaces/aza-miniapp-sdk';

function App() {
  const { status, aza } = useAza();

  if (status === 'loading')     return <Spinner />;
  if (status === 'unavailable') return <OpenInAzaBanner />;

  // aza is typed as AzaSDK — full autocomplete
  return <Dashboard aza={aza} />;
}
```

---

## `AzaSDK` methods

All methods return a `Promise`. They reject with a plain `Error` if:
- The required permission wasn't declared or the user didn't grant it
- A network error occurs
- The user cancelled (for `requestPayment`)

---

### `aza.getUser(): Promise<AzaUser>`

Returns the authenticated user's profile.

```ts
const user = await aza.getUser();
```

```ts
interface AzaUser {
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone?: string;   // only if USER_PHONE was granted
  email?: string;   // only if USER_EMAIL was granted
}
```

Always available after consent. Does not require any extra permission beyond `USER_PROFILE` (which is implicit).

---

### `aza.getBalance(): Promise<AzaBalance>`

Returns the user's live wallet balance in GHS.

```ts
const { balance } = await aza.getBalance();
console.log(`You have GHS ${balance.toFixed(2)}`);
```

```ts
interface AzaBalance {
  balance: number; // GHS, e.g. 245.50
}
```

Requires: `READ_BALANCE` permission.

---

### `aza.requestPayment(params): Promise<AzaPaymentResult>`

Shows a **native confirmation dialog**. No money moves until the user taps "Confirm".

```ts
const result = await aza.requestPayment({
  amount: 5.00,
  recipientIdentifier: 'your_aza_username',
  note: 'Premium subscription – June 2026',
  idempotencyKey: crypto.randomUUID(),
});
```

```ts
interface AzaPaymentRequest {
  amount: number;               // GHS
  recipientIdentifier: string;  // Aza username, phone, or email
  note?: string;                // max 200 chars, shown on receipt
  idempotencyKey: string;       // unique per payment attempt
}

interface AzaPaymentResult {
  transactionId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  recipientUsername: string;
  note: string | null;
}
```

Requires: `MAKE_PAYMENTS` permission.

See [Payments](./04-payments.md) for the full guide including error handling and retries.

---

### `aza.close(): Promise<void>`

Closes the mini app and returns the user to the Aza hub.

```ts
await aza.close();
```

---

### `aza.share(options): Promise<void>`

Opens the native Aza share sheet.

```ts
await aza.share({
  title: 'Check this out',
  message: 'I just paid with Aza! Try it: https://example.com',
});
```

```ts
interface AzaShareOptions {
  title?: string;
  message: string;
}
```

---

### `aza.version: string`

The bridge version string injected by the Aza app, e.g. `"1.0.0"`. Read-only.

```ts
console.log(aza.version); // "1.0.0"
```

---

## Error handling

```ts
import { AzaNotAvailableError, waitForAza } from '@az-spaces/aza-miniapp-sdk';

try {
  const aza = await waitForAza();
  const user = await aza.getUser();
} catch (err) {
  if (err instanceof AzaNotAvailableError) {
    // Not running inside Aza
  } else {
    // API error — err.message has details
  }
}
```

---

## TypeScript path

If you use `paths` in `tsconfig.json` and want the types to resolve from source during development:

```json
{
  "compilerOptions": {
    "paths": {
      "@az-spaces/aza-miniapp-sdk": ["node_modules/@az-spaces/aza-miniapp-sdk/dist/index.d.ts"]
    }
  }
}
```

This is usually unnecessary — the `exports.types` field in the package handles it automatically.
