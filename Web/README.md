# Arc

Arc is a quiet night reflection prototype centered on Nilo's memory.

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

## Notes

Do not put `GEMINI_API_KEY` in frontend JavaScript. Keep it in the server environment.
