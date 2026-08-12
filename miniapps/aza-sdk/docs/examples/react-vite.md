# Example: React + Vite Mini App

A complete, production-ready mini app that accepts a payment and unlocks a feature.

---

## Project structure

```
my-mini-app/
├── src/
│   ├── main.tsx          ← entry point
│   ├── App.tsx           ← root component
│   ├── aza-mock.ts       ← dev-only bridge mock
│   └── components/
│       ├── LoadingScreen.tsx
│       ├── Paywall.tsx
│       └── PremiumContent.tsx
├── index.html
├── vite.config.ts
└── package.json
```

---

## Setup

```bash
npm create vite@latest my-mini-app -- --template react-ts
cd my-mini-app
npm install @az-spaces/aza-miniapp-sdk
```

---

## `src/aza-mock.ts`

```ts
import type { AzaSDK } from '@az-spaces/aza-miniapp-sdk';

const mock: AzaSDK = {
  version: 'mock',
  getUser: async () => ({
    username: 'kwame_test',
    firstName: 'Kwame',
    lastName: 'Asante',
    avatarUrl: null,
  }),
  getBalance: async () => ({ balance: 50.00 }),
  requestPayment: async (p) => {
    await new Promise(r => setTimeout(r, 600));
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

if (import.meta.env.DEV && !window.aza) {
  (window as any).aza = mock;
}
```

---

## `src/main.tsx`

```tsx
import './aza-mock'; // must be first
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## `src/App.tsx`

```tsx
import { useAza, AzaSDK } from '@az-spaces/aza-miniapp-sdk';
import { useState } from 'react';
import LoadingScreen from './components/LoadingScreen';
import Paywall from './components/Paywall';
import PremiumContent from './components/PremiumContent';

export default function App() {
  const { status, aza } = useAza();
  const [paid, setPaid] = useState(false);

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unavailable') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Please open this app in Aza.</p>
      </div>
    );
  }

  return paid
    ? <PremiumContent aza={aza} />
    : <Paywall aza={aza} onPaid={() => setPaid(true)} />;
}
```

---

## `src/components/Paywall.tsx`

```tsx
import { AzaSDK } from '@az-spaces/aza-miniapp-sdk';
import { useState } from 'react';

interface Props {
  aza: AzaSDK;
  onPaid: () => void;
}

export default function Paywall({ aza, onPaid }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const result = await aza.requestPayment({
        amount: 5.00,
        recipientIdentifier: 'your_aza_username', // replace with YOUR Aza username
        note: 'Premium access – one-time',
        idempotencyKey: crypto.randomUUID(),
      });

      if (result.status === 'COMPLETED') {
        onPaid();
      } else {
        setError('Payment is processing. Please wait a moment.');
      }
    } catch (err: any) {
      if (err.message === 'User cancelled payment') {
        // User tapped Cancel — don't show an error
      } else {
        setError(err.message ?? 'Payment failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Premium Content</h1>
      <p>Unlock full access for GHS 5.00</p>

      {error && (
        <p style={{ color: 'red', fontSize: 14 }}>{error}</p>
      )}

      <button
        onClick={handlePay}
        disabled={loading}
        style={{ padding: '12px 24px', fontSize: 16 }}
      >
        {loading ? 'Processing…' : 'Pay GHS 5.00 with Aza'}
      </button>
    </div>
  );
}
```

---

## `src/components/PremiumContent.tsx`

```tsx
import { AzaSDK } from '@az-spaces/aza-miniapp-sdk';

interface Props {
  aza: AzaSDK;
}

export default function PremiumContent({ aza }: Props) {
  return (
    <div style={{ padding: 24 }}>
      <h1>Welcome!</h1>
      <p>You now have full access.</p>
      <button onClick={() => aza.close()}>
        Close
      </button>
    </div>
  );
}
```

---

## `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Warn if any chunk exceeds 500 kB — keep bundles small for fast WebView loads
    chunkSizeWarningLimit: 500,
  },
});
```

---

## Deploy to Vercel

```bash
npm install -g vercel
npm run build
vercel deploy --prod
```

Copy the production URL (e.g. `https://my-mini-app.vercel.app`) and use it when submitting to Aza.
