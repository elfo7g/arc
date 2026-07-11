# Arc iOS

Native SwiftUI client for Arc, talking directly to the same Supabase backend
as `mobile/expo` (auth, `user_state` sync, and the `nilo` Edge Function).

## Open

Open this project on a Mac with Xcode 16+:

```text
mobile/iOS/Arc.xcodeproj
```

Build the `Arc` target for an iPhone simulator or device. There is no local
server involved anymore — the app talks to Supabase directly using the URL
and anon key in `Arc/Info.plist`.

## Auth

- Google OAuth via `ASWebAuthenticationSession` + PKCE (`ArcSupabase.swift`).
  Requires the `app.arc.nilo.native://auth-callback` redirect URL to be added
  to the Supabase project's allowed redirect URLs.
- Email OTP (`auth/v1/otp` + `auth/v1/verify`), same as the RN app.
- Session tokens are stored in the iOS Keychain, never `UserDefaults`.

## Current scope

- Native SwiftUI shell: Home / Quest / Journal / Story tabs (Quest and Story
  are placeholders for now).
- Night Ritual input flow backed by the real `nilo` Edge Function, with the
  RN client's current behavior: 100-char input limit (ja), unintelligible
  answers bounced back without logging, ritual door open only while
  unrecorded and inside the 20:00–03:00 window (or on the very first record),
  journal entries written in the RN app's synced schema (`dateKey` / `lines`
  / `event` / `meaning` / `dialogue` / ...), and a memory excerpt appended on
  completion (respecting `settings.privacy.memoryLink`).
- 「たずねる」(life chat): appears once 5+ memories exist and the ritual door
  is closed; mutually exclusive with the ritual (auto-closes when the ritual
  window opens unrecorded). Sends only memory/chapter excerpts (§4.5 / G3).
  Raw session logs are never persisted — only an explicit user-confirmed
  journal summary (which then also carries the dialogue log, nilo v4), via
  the `life-chat` / `life-chat-summary` routes. On-device distress detection
  quietly surfaces a support-resource link.
- Home shows the lifetime "Day N" counter (birthdate-based, not usage-based)
  and a time-aware greeting, matching the RN home.
- Journal tab: recent-6-month picker (no gap/count display), entries with
  date / title / lines, and an in-place "···" disclosure for saved dialogue
  logs.
- `user_state` synced via `get_user_state`/`set_user_state` RPCs. `journal`
  is strongly modeled on the RN schema (unknown per-entry keys round-trip via
  `JournalEntry.rest`); everything else round-trips untouched via
  `UserStateBlob.rest` so this client can't clobber fields only the RN app
  understands yet.
- Liquid Glass (`.buttonStyle(.glass)`, tab bar chrome) applied only where
  iOS 26 is available, and only to navigation-layer chrome, not content cards.

## Not built yet

Chapters, full quest proposals UI, notifications, settings beyond sign-out
(ritual window / cadence / privacy switches are read from synced state but
not editable here), i18n beyond Japanese, and the RN app's visual layer
(Diary v1 typography, Nilo light/motes, Nilo Variation dialogue devices).
Behavior parity is with the RN client as of the Ask-to-journal /
day-counter / month-picker work (2026-07-11).

## CI

`.github/workflows/ios-build.yml` builds the `Arc` target on `macos-latest`
for the iOS Simulator on every push/PR touching `mobile/iOS/**`. There is no
local Mac in this workflow, so CI is the primary verification loop — push and
iterate against its output rather than expecting a first-try green build.
