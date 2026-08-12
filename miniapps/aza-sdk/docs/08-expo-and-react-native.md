# Building with Expo / React Native

Mini apps run in a WebView, but you don't have to abandon React Native to build one. Expo
exports to web through react-native-web, so you keep your components, your router and your
workflow.

> **Starting from scratch?** Prefer Vite + React. It produces a bundle a fraction of the size
> with no react-native-web layer in between. Expo web export is the right tool when you
> already have React Native code worth keeping.

---

## 1. Configure web output

In `app.json`:

```json
{
  "expo": {
    "web": {
      "bundler": "metro",
      "output": "single"
    }
  }
}
```

| Output mode | Result | Use for mini apps? |
|-------------|--------|--------------------|
| `single` | One `index.html`, client-side routing, no server | **Yes** |
| `static` | One HTML file per route, needs host-side rewrites | No — extra hosting complexity |
| `server` | Requires a Node server at runtime | No — mini apps are static |

---

## 2. Export and test

```bash
npx expo export --platform web   # → ./dist
npx serve dist                   # must work with NO backend running
```

If `npx serve dist` gives you a working app with nothing else running, you have something a
mini app host can serve. That is the whole bar.

---

## 3. Reach the Aza bridge

Under react-native-web, `window` is the real DOM window, so the SDK works unchanged. Guard on
platform so your native builds keep compiling:

```tsx
import { Platform } from 'react-native';
import { waitForAza, isInsideAza } from '@az-spaces/aza-miniapp-sdk';

if (Platform.OS === 'web' && isInsideAza()) {
  const aza = await waitForAza();
  const user = await aza.getUser();
}
```

A component that works in Expo Go *and* as a mini app:

```tsx
import { Platform, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { waitForAza, isInsideAza } from '@az-spaces/aza-miniapp-sdk';

export default function App() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isInsideAza()) return;
    waitForAza()
      .then(aza => aza.getUser())
      .then(user => setName(user.firstName));
  }, []);

  return (
    <View>
      <Text>{name ? `Hello, ${name}!` : 'Open this inside Aza'}</Text>
    </View>
  );
}
```

`window.aza` does **not** exist in Expo Go or a simulator build — the bridge is injected only
by the Aza WebView. Use the mock bridge from [Local Development](./05-local-development.md)
while you build.

---

## 4. What breaks on web

Native-only modules are absent or stubbed once you export to web. Most of what you'd reach for
is available through the Aza bridge instead:

| Native module | On web | Use instead |
|---------------|--------|-------------|
| `expo-camera` | Partial (getUserMedia) | Test carefully, or redesign the flow |
| `expo-notifications` | Not available | Aza handles user notification |
| `expo-secure-store` | Not available | Server-side state keyed by `aza.getUser()` |
| `@react-navigation/native-stack` | Not available | JS stack, or Expo Router |
| `react-native-maps` | Not available | A web map library, or drop the screen |
| Any unlisted RN package | Check for web support | Verify before committing to it |

---

## 5. Watch your bundle size

A react-native-web bundle is heavy — commonly **500 KB to 1 MB gzipped**, against roughly
150 KB for the same app in Vite + React. On Ghanaian mobile data that is a real cost to your
users and shows up directly in launch-to-interactive time.

Measure before you submit:

```bash
npx expo export --platform web
find dist -name '*.js' -exec gzip -c {} \; | wc -c | awk '{print $1/1024 " KB gzipped"}'
```

Treat anything over **1 MB gzipped** as a problem to fix first. Bundles are also capped at
50 MB uncompressed and 2000 files on upload.

---

## 6. Never assume a subpath

react-native-web resolves assets from the site root. Aza serves every hosted mini app from the
root of its own origin (`https://<app-id>-mini.aza.systems/`), so this works by default —
but if you host it yourself, do not deploy to a subdirectory or your fonts and images will 404
inside the WebView.

---

## 7. Ship it

```bash
npx expo export --platform web
cd dist && zip -r ../bundle.zip .   # zip the CONTENTS of dist, not the folder
```

Upload `bundle.zip` in the developer portal. See
[Getting Started](./01-getting-started.md#hosting-let-aza-host-it-or-host-it-yourself).

> Zipping the folder rather than its contents is the single most common upload mistake. Aza
> unwraps a single top-level directory automatically, so `zip -r bundle.zip dist` also works —
> but anything more deeply nested is rejected with `BUNDLE_NO_INDEX`.

---

## Next steps

- [Already have a mobile app?](./09-existing-mobile-apps.md) — bringing an existing native app to Aza
- [SDK Reference](./02-sdk-reference.md)
- [Local Development](./05-local-development.md)
- [Submission Guide](./06-submission-guide.md)
