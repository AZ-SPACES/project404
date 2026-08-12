# Submission Guide

---

## Before you submit

Work through this checklist. Apps that fail basic checks are rejected immediately.

### Technical requirements

- [ ] App is live at an **HTTPS URL** (not `localhost`, not `http://`)
- [ ] URL loads correctly in a mobile browser (Chrome on Android, Safari on iOS)
- [ ] No `console.error` spam on load
- [ ] App renders correctly at **375 × 812 px** (iPhone 14 viewport — the Aza WebView size)
- [ ] No broken images, fonts, or assets
- [ ] `window.aza` mock is **not present** in the production build
- [ ] Only declared permissions are called in code (no calls to undeclared ones)
- [ ] Payments use unique `idempotencyKey` per attempt
- [ ] App handles `aza.requestPayment()` rejection gracefully (user cancel, insufficient funds)
- [ ] HTTPS is enforced — no mixed-content warnings

### Content requirements

- [ ] App does what the description says
- [ ] No adult content, gambling, or illegal services
- [ ] No misleading UI (fake Aza branding, fake payment confirmations, etc.)
- [ ] Privacy policy URL provided if you collect any user data
- [ ] Support URL is reachable

---

## Submitting

Open Aza → Hub → Developer → **Mini Apps** tab → **New App** (or edit an existing draft).

### Fields

**App ID** *(required, permanent)*  
A lowercase alphanumeric slug, hyphens allowed. Examples: `my-store`, `tutoring-app`, `quiz123`.  
Cannot be changed after first submission. Choose carefully.

**Name** *(required)*  
Shown in the hub and on the consent sheet. Max 60 chars. No "Aza" in the name unless you have a partnership agreement.

**Description** *(required)*  
What your app does. Be specific. Max 500 chars.
- Good: "Pay for KNUST printing services and track your print jobs."
- Bad: "A cool app for students."

**Developer name** *(required)*  
Your name or your company name, as you want it shown to users.

**URL** *(required)*  
Your live HTTPS URL. Must load your app — not a landing page, not a redirect, not a maintenance page.

**Icon URL** *(optional)*  
Direct link to a square PNG/JPG, at least 256×256 px, hosted at HTTPS. If omitted, a placeholder icon is shown.

**Version** *(optional)*  
Freeform version string, e.g. `1.0.0`. Not validated — for your reference.

**Category** *(required)*  
Choose the most accurate category:
- `payments` — money transfers, bill splitting, subscriptions
- `shopping` — e-commerce, marketplaces
- `services` — bookings, appointments, deliveries
- `entertainment` — games, media, social
- `education` — learning, tutoring, courses
- `utilities` — tools, calculators, productivity
- `food` — restaurants, ordering, delivery
- `other`

**Permissions** *(declare all you need)*  
See [Permissions](./03-permissions.md). Only tick what you use. Unused permissions are grounds for rejection.

**Support URL** *(optional but recommended)*  
A webpage or email link where users can get help. Example: `https://your-app.com/support` or `mailto:support@your-app.com`.

---

## Review process

Typical turnaround: **2–5 business days**.

The review team checks:
1. App loads and renders correctly in the Aza WebView
2. Declared permissions match actual SDK calls in the app
3. Payments work as described and show the correct amounts
4. Content policy compliance
5. No security violations (see [Security](./07-security.md))

You'll receive an in-app notification when review completes.

---

## If your app is rejected

The rejection reason is shown in the Developer dashboard under your app. Common reasons and fixes:

| Reason | Fix |
|--------|-----|
| `APP_URL_NOT_REACHABLE` | Check your hosting, SSL cert, and that the URL doesn't require login |
| `UNDECLARED_PERMISSION` | You call `aza.getBalance()` but didn't declare `READ_BALANCE` |
| `UNUSED_PERMISSION` | You declared `USER_EMAIL` but never call `user.email` |
| `MIXED_CONTENT` | Your HTTPS page loads HTTP resources — fix all asset URLs |
| `BROKEN_LAYOUT` | App doesn't render at 375×812 — test on a real phone |
| `POLICY_VIOLATION` | Content or functionality violates Aza's terms |
| `MISLEADING_DESCRIPTION` | What the app does doesn't match the description |

After fixing:
1. Go to Developer → Mini Apps → your app
2. Make your changes (if it's ACTIVE you'll need to submit an update; if REJECTED you can edit and resubmit)
3. Tap **Resubmit**

---

## Updating a live app

Changes to a live (ACTIVE) app require re-review:

1. Edit your app in the Developer dashboard — description, URL, permissions, etc.
2. Tap **Submit Update**
3. App status changes to `PENDING_REVIEW`
4. **Your current live version stays active** during review — users aren't disrupted
5. On approval, the update goes live

**URL-only deploys** (you push new code to the same URL) don't require re-review. The WebView always loads the latest version of your URL.

**Permission changes** always require re-review. Adding a permission also triggers a new consent sheet for existing users.

---

## App versioning strategy

Since Aza always loads your live URL, you control your own release cycle:

- Deploy updates to your URL at any time — no review needed for code changes
- Only re-submit when you change the metadata (description, permissions, URL, category)
- Use semantic versioning in the **Version** field as a record for your team
