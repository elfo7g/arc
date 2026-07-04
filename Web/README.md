# Arc

Arc is a quiet night reflection prototype centered on Nilo's memory.

## Front-Ends

This repo has three front-end surfaces sharing the same local API:

- `mobile/expo/` - the mature, primary app (React Native / Expo), used on-device through Expo Go and previewed in-browser through `expo-web`.
- `Web/` - a lighter vanilla HTML/CSS/JS prototype used for fast iteration and automated preview verification.
- `mobile/iOS/` - a native SwiftUI prototype. Build verification requires macOS/Xcode.

### Running mobile/expo

```bash
cd mobile/expo
npx expo start
```

Scan the QR code with Expo Go for the native app. The browser preview (`scripts/expo-web.cmd`, port 8090) runs Metro in CI mode, so it does not hot-reload. Restart the preview server after editing `App.js` to pick up changes.

## AI Setup

Arc uses the Gemini API through a small local Node server so the API key is not exposed in the browser.

1. Copy `.env.example` to `.env`.
2. Set `GEMINI_API_KEY`.
3. Start the API server:

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

The server exposes these local Nilo endpoints:

- `POST /api/nilo/night-ritual` - turns the night dialogue into a journal entry, memory, mood signal, and closing line.
- `POST /api/nilo/chapters` - proposes retrospective life chapters from saved memories.
- `POST /api/nilo/quest-proposals` - proposes longer explorations from recurring themes in memory.
- `POST /api/nilo/evening-message` - creates a quiet evening prompt.
- `POST /api/nilo/reflection` and `POST /api/nilo/tomorrow-quests` remain server-side compatibility endpoints.

Daily task-style quests have been retired. Current clients send `activeQuests: []`; the Quest tab is for Nilo-proposed explorations, not square daily checklist tiles.

Life Chapters are retrospective-only: Nilo proposes a chapter from recent reflections and the user approves or edits it, never the reverse. See `mobile/expo/App.js` for the main chapter and quest-proposal UI.

## Notes

Do not put `GEMINI_API_KEY` in frontend JavaScript. Keep it in the server environment.
