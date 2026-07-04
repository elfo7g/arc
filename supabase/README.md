# Arc Supabase

Gemini-backed Nilo logic now lives in a Supabase Edge Function.

## Secrets

Set the Gemini key on Supabase, not in the client:

```powershell
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_FALLBACK_MODEL` is optional.

## Deploy

```powershell
cd C:\Users\g048fnu\Documents\The_Arc
supabase functions deploy nilo
```

## Function Routes

The single `nilo` function accepts a `route` field in the JSON body:

- `night-ritual`
- `chapters`
- `quest-proposals`

Example:

```json
{
  "route": "night-ritual",
  "messages": [{ "role": "user", "text": "今日は少し歩けた" }],
  "questionCount": 1,
  "forceFinish": false,
  "activeQuests": []
}
```

Daily task-style quests remain retired. The function only judges long-form explorations when the client sends `activeQuests`.
