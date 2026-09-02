# Aza Mobile App

Aza is a comprehensive financial and wallet mobile application built with React Native and Expo. It allows users to manage their accounts, send and receive money, manage contacts, view transactions, and scan QR codes for quick interactions.

## Features

- **User Authentication & Profile Management**: Secure login, profile editing, and user identity management (via handles).
- **Wallet & Transactions**: View account balances, send/receive money, and download transaction statements (PDFs).
- **Contacts Management**: Add contacts, handle friend requests (Pending, Approved, Rejected), block users, and search by handle.
- **QR Code Scanning**: Quickly find other users and initiate transactions by scanning their profile QR codes.
- **Real-time Notifications**: Configurable notification settings synchronized with the backend.
- **Legal & Compliance**: Integrated Terms of Service, Privacy Policy, and PEP (Politically Exposed Person) status handling.
- **Help & Support**: Dedicated support categories (Sending money, Managing account, Holding money, Aza card, Aza Business) and a Contact Us flow.

## Tech Stack

- **Framework**: React Native with [Expo](https://expo.dev/)
- **Navigation**: React Navigation (Bottom Tabs, Native Stack)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **API Networking**: Axios (communicating with a Java Spring Boot backend)
- **Styling / UI**: React Native core components and Vector Icons
- **Hardware/Device APIs**: Expo Camera, Contacts, Location, Local Authentication, File System, Sharing, Notifications, Secure Store

## Getting Started

### Prerequisites

- Node.js (v18 or newer recommended)
- npm or yarn
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator
- (Optional) Expo Go app installed on your physical device

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   cd project404/aza
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

### Running the App

- Press `i` in the terminal to open the iOS simulator.
- Press `a` in the terminal to open the Android emulator.
- Scan the QR code with your phone's camera (iOS) or Expo Go app (Android) to run on a physical device.

### Running in Expo Go

`npm start` launches in development-build mode, because `expo-dev-client` is
installed. To run inside Expo Go instead:

```bash
npm run start:go
```

Expo Go ships a fixed set of native modules, so the features built on native
code we add ourselves are unavailable there and degrade rather than crash:

| Feature | In Expo Go |
| --- | --- |
| Voice / video calls (`react-native-webrtc`, `react-native-incall-manager`) | Call setup fails and is logged; the rest of chat works |
| Rasterising a view (`react-native-view-shot`) | Capture fails cleanly: the QR poster shares as a link, the receipt reports it could not be saved, edited chat photos send unedited |
| The OS-native tab bar (`react-native-bottom-tabs`) | Falls back to the JS tab bar |
| Apple Watch mirroring (`modules/aza-watch`) | No-op |
| Remote push notifications | Not registered; local notifications still work |
| OTA updates (`expo-updates`) | Disabled |

Everything gated this way goes through `src/native/` (see
`src/native/optional.ts`) or `src/lib/expoGo.ts`. Adding a dependency with
native code means adding a wrapper there too — importing such a package
directly crashes the bundle as it evaluates, before any error boundary exists,
with "Invariant Violation: Your JavaScript code tried to access a native module
that doesn't exist".

Use a development build (`npm run ios` / `npm run android`) to exercise any of
the features above.

## Testing

The project uses Jest and React Native Testing Library for testing.

Run the test suite:
```bash
npm test
```

## Folder Structure (src/)

- `src/features/` - Feature-based modules containing their respective screens and components (e.g., `home`, `contacts`, `auth`).
- `src/store/` - Zustand state management stores (e.g., `contactStore.ts`).
- `src/services/` - API integration and networking logic (e.g., `api.ts`).

## License

Private / Proprietary
