# Maestro E2E Tests - Aza App

End-to-end tests for the Aza mobile app (`com.semekor.k.aza`) using [Maestro](https://maestro.mobile.dev).

## Setup

Install Maestro CLI:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## Running Tests

Run a single flow:
```bash
maestro test maestro/07_home.yaml
```

Run all tests in order:
```bash
maestro test maestro/
```

Run with environment overrides:
```bash
maestro test --env TEST_PHONE=0201234567 --env TEST_PASSWORD=Test@1234 maestro/02_login_phone.yaml
```

## Test Files

| File | Description |
|------|-------------|
| `_config.yaml` | Shared environment variables |
| `01_onboarding.yaml` | Onboarding carousel + entry buttons |
| `02_login_phone.yaml` | Login with phone number |
| `03_login_email.yaml` | Login with email + toggle |
| `04_trouble_login.yaml` | Trouble login issue paths |
| `05_signup.yaml` | Full multi-step signup flow |
| `06_otp_screen.yaml` | OTP input and resend |
| `07_home.yaml` | Home screen balance & actions |
| `08_send_money.yaml` | Full send money flow |
| `09_request_money.yaml` | Request money flow |
| `10_contacts.yaml` | Contacts list & bottom sheet |
| `11_chat_list.yaml` | Chat contacts, filters |
| `12_chat_conversation.yaml` | Messaging, attachments, menus |
| `13_scan_qr.yaml` | QR scanner and My Code |
| `14_profile.yaml` | Profile & all settings |
| `15_security_settings.yaml` | Security & privacy |
| `16_kyc_flow.yaml` | KYC identity verification |
| `17_setup_passcode.yaml` | First-time passcode setup |
| `18_personal_details.yaml` | Edit personal information |
| `19_inbox.yaml` | Notifications inbox |
| `20_help_support.yaml` | Help & support screens |

## Notes

- Tests `01–06` cover unauthenticated flows (onboarding, auth, signup)
- Tests `07–20` assume the user is already logged in
- KYC and camera-dependent steps (`16`) require a physical device
- OTP screens require test accounts with known OTP values or mock mode
- Environment variables in `_config.yaml` can be overridden at runtime
