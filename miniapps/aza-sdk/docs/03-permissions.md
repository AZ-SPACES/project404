# Permissions

Permissions are declared at submission time. Users see them on a **consent sheet** the first time they open your app — they can Allow or Deny. If they deny, `aza.getUser()` / `aza.getBalance()` etc. will throw.

---

## Permission reference

| Key | What it grants | Notes |
|-----|---------------|-------|
| `USER_PROFILE` | `username`, `firstName`, `lastName`, `avatarUrl` | Implicit — always included, no need to declare |
| `USER_PHONE` | `phone` field on `AzaUser` | Only request if you need to verify or contact the user |
| `USER_EMAIL` | `email` field on `AzaUser` | Only request if you send receipts or account emails |
| `MAKE_PAYMENTS` | Call `aza.requestPayment()` | Required for any paid features |
| `READ_BALANCE` | Call `aza.getBalance()` | Request only if your UI shows a balance indicator |
| `READ_TRANSACTIONS` | Read transaction history | Coming soon |

---

## Principle of least privilege

Only declare permissions you actively use. The review team will reject apps that request permissions without a clear purpose. Each extra permission makes users less likely to grant consent.

**Bad** — blanket permissions:
```
USER_PROFILE, USER_PHONE, USER_EMAIL, MAKE_PAYMENTS, READ_BALANCE
```

**Good** — a payment app that shows balance:
```
USER_PROFILE, MAKE_PAYMENTS, READ_BALANCE
```

**Good** — a directory app that sends email receipts:
```
USER_PROFILE, USER_EMAIL
```

---

## Consent flow

1. User taps your app in the hub for the first time.
2. Aza shows a **consent sheet** listing your declared permissions and what each one does.
3. User taps **Allow** or **Don't Allow**.
4. On Allow: your app loads and all SDK calls work.
5. On Deny: your app loads but SDK calls for denied permissions throw an error.

The user can revoke consent later from their Aza profile settings.

---

## Handling denied consent

Always handle the case where a user denies a permission. Don't assume they allowed everything.

```ts
const aza = await waitForAza();

let phone: string | undefined;
try {
  const user = await aza.getUser();
  phone = user.phone; // undefined if USER_PHONE not granted
} catch {
  // getUser() itself rejected — USER_PROFILE denied (rare)
}

// Gracefully degrade
if (!phone) {
  showManualPhoneInput();
}
```

For `MAKE_PAYMENTS` specifically, if the user denies it your entire payment flow is blocked — consider showing a message explaining why the permission is needed.

```ts
try {
  await aza.requestPayment({ ... });
} catch (err) {
  if (err.message.includes('permission')) {
    showUI('Payment access was not granted. Please reinstall the app and allow payments.');
  } else if (err.message.includes('cancelled')) {
    // User tapped Cancel on the native dialog — this is normal
  } else {
    showUI('Payment failed. Please try again.');
  }
}
```

---

## Changing permissions after submission

If you need a new permission after your app is already ACTIVE, you must submit an **update** through the Developer dashboard. The app goes back to PENDING_REVIEW. Existing users will see the consent sheet again with the new permissions listed.

Removing a permission works the same way — submit an update, the review team will verify you've removed all uses of that permission from your code.
