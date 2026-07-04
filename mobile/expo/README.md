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

The app calls the local Web API server, currently configured in `app.json`:

```json
"arcApiBaseUrl": "http://192.168.0.20:4173"
```

For a physical iPhone, replace this with your PC/Mac LAN IP:

```json
"arcApiBaseUrl": "http://192.168.1.20:4173"
```

Start the Web API server separately:

```powershell
cd C:\Users\g048fnu\Documents\The_Arc\Web
npm start
```

## Current Scope

- Expo Go-compatible React Native app.
- Home / Journal / Quest / Story / Memory tabs.
- Night Ritual input flow that saves journal entries and memories.
- Journal timeline with recent entries, monthly bands, and older records handed off to chapters.
- Quest tab for Nilo-proposed longer explorations from recurring memory themes.
- Story tab for retrospective chapter proposals.
- Settings modal with profile, data ownership/export, privacy, notification, audio, display, account, and inheritance controls.
- Shared Arc/Nilo visual assets.

## Retired

Daily task-style quests and square daily quest tiles are no longer part of the app. The client sends `activeQuests: []`; quest progression now belongs to Nilo-proposed explorations rather than a checklist.
