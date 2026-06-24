# Arc Expo

Expo Go prototype for Arc.

Official Expo docs currently recommend using the Expo Go-compatible SDK line when testing on a physical device during SDK transitions. This project is set up as an Expo Go app.

## Start

```powershell
cd C:\Users\g048fnu\Documents\The_Arc\mobile\expo
npm install
npx expo start
```

Then scan the QR code with Expo Go.

## API

The app calls:

```text
http://192.168.0.19:4173/api/nilo/night-ritual
```

For a physical iPhone, `extra.arcApiBaseUrl` in `app.json` must point to your PC/Mac LAN IP:

```json
"arcApiBaseUrl": "http://192.168.1.20:4173"
```

Start the Web API server separately:

```powershell
cd C:\Users\g048fnu\Documents\The_Arc\Web
npm start
```

## Current Scope

- Expo Go compatible React Native app
- Home / Journal / Quest / Story / Memory tabs
- Night Ritual input flow
- Square daily quest tiles
- Settings modal with profile day count
- Shared Arc/Nilo visual assets
