# Arc

Arc is a quiet night reflection prototype centered on Nilo's memory.

## Front-ends

This repo has two front-ends sharing the same API:

- `mobile/expo/` — the mature, primary app (React Native / Expo), used on-device via Expo Go and previewed in-browser through `expo-web`.
- `Web/` (this directory) — a lighter vanilla HTML/CSS/JS prototype used for fast iteration and automated preview verification.

### Running mobile/expo

```bash
cd mobile/expo
npx expo start
```

Scan the QR code with Expo Go for the native app. The browser preview (`scripts/expo-web.cmd`, port 8090) runs Metro in CI mode, so it does **not** hot-reload — restart the preview server after editing `App.js` to pick up changes. The web preview is letterboxed to a fixed phone aspect ratio so it always previews like a phone screen rather than stretching to the browser window.

## AI Setup

Arc uses the Gemini API through a small local Node server so the API key is not exposed in the browser.

1. Copy `.env.example` to `.env`.
2. Set `GEMINI_API_KEY`.
3. Start the app:

```bash
npm start
```

Then open:

```text
http://localhost:4173
```

## Environment

```text
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=4173
```

## API

`POST /api/nilo/reflection`

The browser sends the user's daily reflection plus compressed recent memories and active quests. The server calls Gemini `generateContent` and returns a compact Nilo insight:

- mood label and score
- Nilo's short line
- compressed memory
- optional quest suggestion
- optional life chapter

Life Chapters are retrospective-only: Nilo proposes a chapter from recent reflections and the user approves or edits it, never the reverse. See `mobile/expo/App.js` for the chapters UI that consumes this.

## Notes

Do not put `GEMINI_API_KEY` in frontend JavaScript. Keep it in the server environment.
