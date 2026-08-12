# Payments

Mini apps can charge users directly from their Aza wallet. The payment always goes through a **native confirmation dialog** — your code never moves money without explicit user consent.

---

## The payment flow

```
1. Your app calls aza.requestPayment({ amount, recipientIdentifier, ... })
        │
        │  PostMessage to native bridge
        ▼
2. Aza shows native confirmation modal:
   ┌─────────────────────────────┐
   │  Pay GHS 5.00               │
   │  To: your_store             │
   │  Note: Premium subscription │
   │  ─────────────────────────  │
   │  This payment cannot be     │
   │  reversed.                  │
   │                             │
   │  [Cancel]      [Confirm]    │
   └─────────────────────────────┘
        │
        │  User taps Confirm
        ▼
3. Aza processes the payment
        │
        ▼
4. Promise resolves with AzaPaymentResult
   { transactionId, status: 'COMPLETED', amount, recipientUsername, note }
```

If the user taps **Cancel**, the Promise rejects with `"User cancelled payment"`.

---

## Basic example

```ts
import { waitForAza } from '@az-spaces/aza-miniapp-sdk';

const aza = await waitForAza();

async function handleSubscribe() {
  try {
    const result = await aza.requestPayment({
      amount: 5.00,
      recipientIdentifier: 'your_aza_username',   // YOUR account
      note: 'Premium – June 2026',
      idempotencyKey: crypto.randomUUID(),
    });

    if (result.status === 'COMPLETED') {
      unlockPremiumFeatures();
      showReceipt(result.transactionId);
    }
  } catch (err) {
    if (err.message === 'User cancelled payment') {
      // Normal — user changed their mind
    } else {
      alert('Payment failed: ' + err.message);
    }
  }
}
```

---

## Idempotency

**Generate a fresh `idempotencyKey` (UUID) for every new payment intent.**

The key prevents double-charges on network retries. If the same key is submitted twice, Aza returns the original result without charging again.

```ts
// Good — new UUID per attempt
const key = crypto.randomUUID();
await aza.requestPayment({ ..., idempotencyKey: key });

// Good — retry with the SAME key after a network failure
const key = crypto.randomUUID();
let result;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    result = await aza.requestPayment({ ..., idempotencyKey: key });
    break;
  } catch (err) {
    if (err.message === 'User cancelled payment') throw err; // don't retry cancels
    if (attempt === 2) throw err;
  }
}

// Bad — new UUID per retry (can double-charge)
await aza.requestPayment({ ..., idempotencyKey: crypto.randomUUID() }); // ❌
```

The key is namespaced to your app ID internally — a key collision with another app is impossible.

---

## Verifying payment on your server

`requestPayment` resolves client-side. For anything of value, **verify the transaction on your server** before granting access.

```ts
const result = await aza.requestPayment({ ... });

// Send the transactionId to YOUR backend
const response = await fetch('https://your-app.com/api/verify-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ transactionId: result.transactionId }),
});

if (!response.ok) throw new Error('Payment verification failed');
unlockFeature();
```

Your backend verifies the transaction with your merchant API key (from the Aza merchant portal):

```http
GET https://api.aza.systems/api/v1/merchant/transactions/{transactionId}
X-Api-Key: aza_live_YOUR_KEY
```

```jsonc
{
  "success": true,
  "data": {
    "id": "9c8d7e6f-5a4b-4c3d-2e1f-0a9b8c7d6e5f",
    "status": "COMPLETED",   // trust the payment only when this is COMPLETED
    "amount": 5.00,
    "currency": "GHS",
    "note": "Premium access",
    "type": "TRANSFER"
  }
}
```

Only transactions credited to your account are visible; any other id returns `404`. Grant access only when `status` is `COMPLETED` **and** `amount` matches what you expected.

---

## Handling insufficient funds

If the user doesn't have enough balance, `requestPayment` rejects with an error message indicating insufficient funds. Handle this gracefully:

```ts
try {
  await aza.requestPayment({ amount: 50.00, ... });
} catch (err) {
  if (err.message.toLowerCase().includes('insufficient')) {
    showUI('You don\'t have enough balance. Please top up your Aza wallet.');
  }
}
```

---

## Payment states

| Status | Meaning |
|--------|---------|
| `COMPLETED` | Money moved successfully |
| `PENDING` | Processing — poll your server or wait for webhook |
| `FAILED` | Payment was attempted but failed (e.g. system error) |

In practice, most payments resolve as `COMPLETED` immediately. `PENDING` appears transiently during processing.

---

## Amount constraints

- Minimum: **GHS 0.01**
- Maximum: set by the user's Aza account limits
- Precision: up to 2 decimal places (GHS 5.00, not GHS 5.001)
- Currency: **GHS only** (Ghanaian Cedi)

---

## Note field

The `note` appears on the user's transaction history and receipt. Best practices:

- Keep it under 80 characters for clean display
- Be specific: `"Order #1042 – 2 items"` not `"Payment"`
- Don't include sensitive data (card numbers, passwords, etc.)
- Max: 200 characters

---

## Testing payments in development

The bridge isn't available in a regular browser. Use a mock:

```ts
// dev-mock.ts — import this only in development builds
if (import.meta.env.DEV && !window.aza) {
  window.aza = {
    version: 'mock',
    getUser: async () => ({
      username: 'testuser', firstName: 'Test', lastName: 'User', avatarUrl: null,
    }),
    getBalance: async () => ({ balance: 100.00 }),
    requestPayment: async (p) => {
      // Simulate a 500ms delay
      await new Promise(r => setTimeout(r, 500));
      return {
        transactionId: `mock-${Date.now()}`,
        status: 'COMPLETED',
        amount: p.amount,
        recipientUsername: p.recipientIdentifier,
        note: p.note ?? null,
      };
    },
    close: async () => {},
    share: async () => {},
  };
}
```

Import it at the top of your entry file:
```ts
// main.tsx
import './dev-mock'; // only active when import.meta.env.DEV === true
```

See [Local Development](./05-local-development.md) for the full dev workflow.
