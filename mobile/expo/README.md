# Arc Expo

Expo Go app for Arc. This is the primary client in the repo.

## Start

```powershell
cd C:\Users\g048fnu\Documents\The_Arc\mobile\expo
npm install
npx expo start
```

Scan the QR code with Expo Go.

For a browser preview, run Expo Web. The project is designed around a phone-shaped viewport, so browser preview should be treated as a mobile preview rather than a responsive desktop app.

## API

The app calls Supabase Edge Functions through the existing Supabase client.
Set these public Expo variables in `mobile/expo/.env`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Gemini stays server-side in Supabase:

```powershell
cd C:\Users\g048fnu\Documents\The_Arc
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
supabase functions deploy nilo
```

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
