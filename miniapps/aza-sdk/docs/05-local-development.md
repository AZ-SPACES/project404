# Local Development

`window.aza` is only injected when your app runs inside the Aza WebView. During local development it won't exist. This guide covers how to develop and test effectively without a real device.

---

## Mock the bridge

Create a file that installs a fake `window.aza` when running locally:

```ts
// src/aza-mock.ts
import type { AzaSDK, AzaUser, AzaPaymentRequest } from '@az-spaces/aza-miniapp-sdk';

const MOCK_USER: AzaUser = {
  username: 'testuser',
  firstName: 'Kwame',
  lastName: 'Asante',
  avatarUrl: null,
  phone: '+233501234567',
  email: 'kwame@example.com',
};

const mock: AzaSDK = {
  version: 'mock',

  getUser: async () => MOCK_USER,

  getBalance: async () => ({ balance: 245.50 }),

  requestPayment: async (p: AzaPaymentRequest) => {
    // Simulate a short delay
    await delay(600);

    // Uncomment to test the cancellation flow:
    // throw new Error('User cancelled payment');

    // Uncomment to test insufficient funds:
    // throw new Error('Insufficient funds');

    return {
      transactionId: `mock-tx-${Date.now()}`,
      status: 'COMPLETED' as const,
      amount: p.amount,
      recipientUsername: p.recipientIdentifier,
      note: p.note ?? null,
    };
  },

  close: async () => {
    console.log('[mock] aza.close() called');
  },

  share: async (opts) => {
    console.log('[mock] aza.share()', opts);
  },
};

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Only install the mock in development and only if the bridge isn't already there
if (import.meta.env.DEV && typeof window !== 'undefined' && !window.aza) {
  (window as any).aza = mock;
  console.info('[aza-mock] Bridge mock installed. This will NOT run in production.');
}
```

Import it at the top of your entry file — **before** any component code runs:

```ts
// src/main.tsx
import './aza-mock';   // must be first
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

Vite's tree-shaker will strip this import in production builds because `import.meta.env.DEV` is statically `false`.

---

## Run locally

```bash
npm run dev
```

Your app opens at `http://localhost:5173`. The mock bridge is active, so all `window.aza.*` calls work normally.

---

## Test on a real device with ngrok

The Aza WebView only loads **HTTPS** URLs. To test your local build on a real device:

1. Install ngrok: `npm install -g ngrok`  
2. Start your dev server: `npm run dev`
3. In a separate terminal: `ngrok http 5173`
4. Copy the `https://xxxx.ngrok.io` URL
5. Open Aza → Developer → your app → **Preview** (or submit a draft with that URL)

The HTTPS tunnel means the WebView loads your local server, and `window.aza` is injected for real — no mock needed.

---

## Hot reload inside the WebView

The Vite dev server supports HMR (hot module replacement). When using ngrok, changes you make locally will hot-reload in the Aza WebView automatically — as long as the WebSocket connection to the dev server stays open.

If HMR breaks (usually because ngrok forwarded a plain HTTP WS connection), add this to `vite.config.ts`:

```ts
export default defineConfig({
  server: {
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
  },
});
```

---

## Simulating different states

Toggle these in `aza-mock.ts` to test edge cases before submitting:

```ts
// Simulate no balance
getBalance: async () => ({ balance: 0 }),

// Simulate USER_PHONE not granted (omit phone field)
getUser: async () => ({ username: 'testuser', firstName: 'Kwame', lastName: 'Asante', avatarUrl: null }),

// Simulate payment cancelled
requestPayment: async () => { throw new Error('User cancelled payment'); },

// Simulate payment failed
requestPayment: async () => {
  await delay(800);
  return { transactionId: 'mock-tx', status: 'FAILED' as const, amount: 0, recipientUsername: '', note: null };
},

// Simulate bridge timeout (never fires azaReady)
// — delete the mock entirely, waitForAza() will reject after 5 s
```

---

## Using React DevTools

React DevTools works normally in both browser and the Aza WebView (on debug builds of Aza). Install the browser extension for local dev.

---

## Build for production

```bash
npm run build
npm run preview  # preview the production build locally
```

Verify that:
- `window.aza` mock is NOT installed in the production build (check the bundle for `aza-mock`)
- All assets are at HTTPS paths (no `http://` hardcoded)
- The bundle size is reasonable — large bundles cause slow load times inside the WebView
