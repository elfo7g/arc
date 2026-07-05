# Arc — Development Build

Custom **development build** (dev client) copy of the Arc app, forked from `mobile/expo/`.
Use this project when you need native modules or debugging that Expo Go can't provide.
The Expo Go client still lives in `mobile/expo/` and is untouched.

## Difference from `mobile/expo/`

| | `mobile/expo/` | `mobile/dev-build/` (this) |
| --- | --- | --- |
| Runtime | Expo Go | Custom dev client (`expo-dev-client`) |
| `npm start` | `expo start --go` | `expo start --dev-client` |
| Native modules | SDK-limited | Full (via EAS build) |
| Build config | none | `eas.json` |

## First-time setup

```powershell
cd C:\Users\g048fnu\Documents\The_Arc\mobile\dev-build
npm install
```

`.env` is copied over (public `EXPO_PUBLIC_*` values only). Confirm it matches
`.env.example` and holds the Supabase URL / anon key and Sentry DSN.

## Building the dev client

A development build is a real native app you install once; after that you just
run the Metro bundler and reload JS against it.

1. Install and log in to EAS (one-time):

   ```powershell
   npm install -g eas-cli
   eas login
   ```

2. Link this project to an EAS project (writes `extra.eas.projectId` into `app.json`):

   ```powershell
   eas init
   ```

3. Build the dev client for a device / simulator:

   ```powershell
   # Android device or emulator
   npm run build:dev:android

   # iOS device (needs an Apple Developer account; cloud-built from Windows)
   npm run build:dev:ios

   # iOS simulator variant
   eas build --profile development-simulator --platform ios
   ```

   Install the resulting artifact on the device/emulator.

## Day-to-day

```powershell
npm start          # expo start --dev-client
```

Open the installed **Arc** dev client and it connects to this Metro server.
Plain Expo Go will **not** open a dev-client bundle — that is expected.

## eas.json profiles

- `development` — dev client, internal distribution, `development` channel.
- `development-simulator` — same, but iOS simulator build.
- `preview` — internal distribution, non-dev-client, `preview` channel.
- `production` — store build with remote auto-increment, `production` channel.

## API / Sentry

Unchanged from `mobile/expo/` — the app talks to Supabase Edge Functions and
Sentry stays disabled until `EXPO_PUBLIC_SENTRY_DSN` is set. See the source
under `src/` (`supabase.js`, `sentry.js`).

## App identity

This copy is deliberately distinct from `mobile/expo/` so both can be installed
on the same device at once:

| | `mobile/expo/` | `mobile/dev-build/` |
| --- | --- | --- |
| Display name | Arc | Arc Dev |
| slug | `arc-nilo` | `arc-nilo-dev` |
| scheme | `arc-nilo` | `arc-nilo-dev` |
| iOS bundle id | `app.arc.nilo` | `app.arc.nilo.dev` |
| Android package | `app.arc.nilo` | `app.arc.nilo.dev` |
