# Arc Expo

Expo Go app for Arc. This is the primary client in the repo.

## Start

```powershell
cd C:\Users\g048fnu\Documents\The_Arc\mobile\expo
npm install
npm start
```

`npm start` and `npx expo start --go` force the QR code to target Expo Go. Because this project also has `expo-dev-client` installed, plain `expo start` can produce a development-build QR code that Expo Go cannot open. Use `npm run start:dev-client` only when launching a custom development build.

Scan the QR code with Expo Go.

For a browser preview, run Expo Web. The project is designed around a phone-shaped viewport, so browser preview should be treated as a mobile preview rather than a responsive desktop app.

## API

The app calls Supabase Edge Functions through the existing Supabase client.
Set these public Expo variables in `mobile/expo/.env`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_publishable_or_anon_key
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn
EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0
```

Gemini stays server-side in Supabase:

```powershell
cd C:\Users\g048fnu\Documents\The_Arc
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
supabase functions deploy nilo
```

## Sentry

Sentry is initialized from `src/sentry.js` before the Expo root component is registered. It stays disabled until `EXPO_PUBLIC_SENTRY_DSN` is set, so Expo Go remains usable without a Sentry project configured.

The default setup is intentionally privacy-conservative for Arc: Sentry events drop breadcrumbs, request data, and user data before sending. Keep `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0` unless performance tracing is explicitly needed.

For production builds, configure Sentry source map upload with your Sentry organization/project and auth token in the build environment. Do not commit Sentry auth tokens.

## Current Scope

- Expo Go-compatible React Native app.
- Home / Journal / Quest / Story / Memory tabs.
- Night Ritual input flow that saves journal entries and memories.
- Journal timeline with recent entries, monthly bands, and older records handed off to chapters.
- Quest tab for Nilo-proposed longer explorations from recurring memory themes.
- AI judgement for ongoing explorations: the close button becomes available only after Nilo returns a clear completion judgement.
- Story tab for retrospective chapter proposals.
- Settings modal with profile, data ownership/export, privacy, notification, audio, display, account, and inheritance controls.
- Shared Arc/Nilo visual assets.

## Retired

Daily task-style quests and square daily quest tiles are no longer part of the app. Quest progression now belongs to Nilo-proposed explorations rather than a checklist.
