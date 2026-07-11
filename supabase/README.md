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

## At-rest encryption

`user_state.data` is stored as `pgp_sym_encrypt`-encrypted bytea, keyed by a
secret in Supabase Vault (migration `20260705000000_user_state_encryption.sql`).
Disk-level at-rest encryption is already on by default for Supabase's storage;
this is column-level, on top of that, so a raw dump/backup/compromised
read-only role doesn't expose plaintext.

The client no longer selects/upserts the table directly — it calls
`get_user_state()` / `set_user_state(p_data)` RPCs, which are the only things
that can reach the vaulted key. This is not zero-knowledge/end-to-end
encryption: the key lives server-side because the `nilo` Edge Function has to
read plaintext to send it to Gemini.

Apply with:

```powershell
supabase db push
```
