# Example: Vanilla JS Mini App

No framework, no build step. Works for simple apps and is the fastest to get running.

---

## Single-file app

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Mini App</title>
  <style>
    body { font-family: sans-serif; padding: 24px; max-width: 400px; margin: 0 auto; }
    button { padding: 12px 20px; font-size: 16px; cursor: pointer; width: 100%; }
    .error { color: red; font-size: 14px; margin-top: 8px; }
    .hidden { display: none; }
  </style>
</head>
<body>

  <div id="loading">Loading…</div>

  <div id="app" class="hidden">
    <h1>Hello, <span id="user-name"></span>!</h1>
    <p id="balance-text"></p>
    <button id="pay-btn">Pay GHS 5.00 with Aza</button>
    <p id="error" class="error"></p>
    <div id="success" class="hidden">
      <h2>Payment complete!</h2>
      <p>Transaction: <span id="tx-id"></span></p>
    </div>
  </div>

  <script type="module">
    // Dev mock — install before SDK initialises
    if (location.hostname === 'localhost' && !window.aza) {
      window.aza = {
        version: 'mock',
        getUser: async () => ({
          username: 'testuser', firstName: 'Kwame', lastName: 'Asante', avatarUrl: null,
        }),
        getBalance: async () => ({ balance: 100.00 }),
        requestPayment: async (p) => ({
          transactionId: 'mock-' + Date.now(),
          status: 'COMPLETED',
          amount: p.amount,
          recipientUsername: p.recipientIdentifier,
          note: p.note ?? null,
        }),
        close: async () => {},
        share: async () => {},
      };
    }

    // waitForAza — inline helper (no npm needed for vanilla JS)
    function waitForAza(timeoutMs = 5000) {
      if (window.aza) return Promise.resolve(window.aza);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          window.removeEventListener('azaReady', onReady);
          reject(new Error('Aza bridge did not initialise in time.'));
        }, timeoutMs);
        function onReady() {
          clearTimeout(timer);
          window.removeEventListener('azaReady', onReady);
          resolve(window.aza);
        }
        window.addEventListener('azaReady', onReady);
      });
    }

    // Helpers
    const $ = id => document.getElementById(id);

    async function init() {
      let aza;
      try {
        aza = await waitForAza();
      } catch {
        $('loading').textContent = 'Please open this app in Aza.';
        return;
      }

      const [user, { balance }] = await Promise.all([aza.getUser(), aza.getBalance()]);

      $('user-name').textContent = user.firstName;
      $('balance-text').textContent = `Your balance: GHS ${balance.toFixed(2)}`;
      $('loading').classList.add('hidden');
      $('app').classList.remove('hidden');

      $('pay-btn').addEventListener('click', async () => {
        $('error').textContent = '';
        $('pay-btn').disabled = true;
        $('pay-btn').textContent = 'Processing…';

        try {
          const result = await aza.requestPayment({
            amount: 5.00,
            recipientIdentifier: 'your_aza_username', // YOUR Aza username
            note: 'Premium access',
            idempotencyKey: crypto.randomUUID(),
          });

          if (result.status === 'COMPLETED') {
            $('pay-btn').classList.add('hidden');
            $('tx-id').textContent = result.transactionId;
            $('success').classList.remove('hidden');
          }
        } catch (err) {
          if (err.message !== 'User cancelled payment') {
            $('error').textContent = err.message || 'Payment failed. Please try again.';
          }
          $('pay-btn').disabled = false;
          $('pay-btn').textContent = 'Pay GHS 5.00 with Aza';
        }
      });
    }

    init();
  </script>
</body>
</html>
```

---

## Deploy

This is a static HTML file. Deploy it to any static host:

**Netlify Drop:**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag your `index.html` onto the page
3. Copy the generated HTTPS URL

**GitHub Pages:**
1. Push to a repo
2. Settings → Pages → Deploy from branch → `main` / root
3. URL: `https://YOUR_USERNAME.github.io/REPO_NAME`

---

## Using the npm SDK in vanilla JS (optional)

If you want the full TypeScript types via a CDN:

```html
<!-- ESM CDN — no npm install needed -->
<script type="module">
  import { waitForAza } from 'https://esm.sh/@az-spaces/aza-miniapp-sdk';

  const aza = await waitForAza();
  const user = await aza.getUser();
  document.body.innerHTML = `<h1>Hello, ${user.firstName}!</h1>`;
</script>
```

This loads the SDK directly from the `esm.sh` CDN. Use SRI hashes in production to pin the version.
