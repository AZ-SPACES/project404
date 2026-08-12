# Already Have a Mobile App?

If you already ship a React Native, Flutter or native mobile app, this page is about the
fastest way into the Aza Hub — and the expensive mistake to avoid.

---

## You don't need an Apple or Google developer account

Mini apps never go through the App Store or Play Store. They are web apps loaded in a WebView
inside the Aza app, so the only developer account involved is Aza's own. Nothing for you to
register, pay for, or wait on.

You don't need a domain or a server either — [Aza can host your
build](./01-getting-started.md#hosting-let-aza-host-it-or-host-it-yourself).

---

## A mini app is not a port of your app

This is the most common and most expensive misunderstanding.

Your native app might have thirty screens. Your mini app needs the two or three that make
money — browse, pay, confirm. Mini apps are a deliberately reduced surface, the same way a
mini program is on WeChat. Chasing feature parity is how teams lose a month.

---

## Pick your path

| Path | When it fits | Effort |
|------|--------------|--------|
| **Rebuild the core flow as a web app** | You already have a backend API. The mini app is a new thin client against it. Right answer for most teams. | Days |
| **Export your Expo app to web** | You're on Expo and avoided native-only modules. Nearly free when it works. | Hours to find out |
| **Deep-link out to your native app** | You genuinely need background location, BLE, or heavy offline. The mini app becomes a launcher card. | Hours |

If you're on Expo, spend one hour running `npx expo export --platform web` before planning
anything larger — see [Building with Expo](./08-expo-and-react-native.md).

---

## The typical shape

When you already have a mobile app and a backend, the mini app uses Aza for identity and
payment and keeps talking to your own API for everything else:

```ts
import { waitForAza } from '@az-spaces/aza-miniapp-sdk';

const aza = await waitForAza();

// 1. Identify the user via Aza — no signup screen, no password.
const user = await aza.getUser();

// 2. Talk to your existing backend as you always have.
const products = await fetch('https://api.your-app.com/v1/products').then(r => r.json());

// 3. Take the money through Aza.
const result = await aza.requestPayment({
  amount: products[0].price,
  recipientIdentifier: 'your_aza_username',
  note: products[0].name,
  idempotencyKey: crypto.randomUUID(),
});

// 4. Settle in your own system, keyed by the Aza transaction id.
if (result.status === 'COMPLETED') {
  await fetch('https://api.your-app.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      azaTransactionId: result.transactionId,
      azaUsername: user.username,
      productId: products[0].id,
    }),
  });
}
```

Your backend adds one endpoint that **verifies the transaction server-side** before fulfilling.
Never trust the client's claim that payment succeeded:

```python
@app.post('/v1/orders')
def create_order():
    body = request.get_json()
    resp = requests.get(
        f"https://api.aza.systems/api/v1/merchant/transactions/{body['azaTransactionId']}",
        headers={'X-Api-Key': 'aza_live_YOUR_KEY'}
    )
    if resp.json()['data']['status'] != 'COMPLETED':
        return jsonify({'error': 'payment not completed'}), 402
    fulfill_order(body['productId'])
    return jsonify({'ok': True})
```

See [Payments](./04-payments.md) for idempotency and verification in full.

---

## Why there is no third-party native tier

Aza ships a handful of first-party mini apps compiled into the Aza binary rather than loaded
over the web. That path is not open to third-party developers, and it's a structural limit
rather than a policy we expect to relax:

- Your crash would become an Aza crash, for every Aza user.
- Your release would be gated on Aza's App Store review cycle, not yours.
- Your native dependencies would change the permissions Aza declares.
- Your code would ship under Aza's developer account — exactly the liability the WebView
  sandbox exists to contain.

The WebView boundary is what lets us approve your app in days instead of tying it to our
release train.

> **Do not** load a remote React Native bundle inside your mini app to recreate a native
> experience. Apple's guideline 4.7 permits mini apps inside a host app *on the condition that
> they are HTML5*. A remote native bundle puts the entire Aza app's review at risk, and
> submissions doing this are rejected.

---

## Next steps

- [Building with Expo / React Native](./08-expo-and-react-native.md)
- [Getting Started](./01-getting-started.md)
- [Submission Guide](./06-submission-guide.md)
