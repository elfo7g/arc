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
- Night Ritual input flow backed by the real `nilo` Edge Function.
- `user_state` synced via `get_user_state`/`set_user_state` RPCs. Only
  `journal` is strongly modeled; everything else round-trips untouched via
  `UserStateBlob.rest` so this client can't clobber fields only the RN app
  understands yet.
- Liquid Glass (`.buttonStyle(.glass)`, tab bar chrome) applied only where
  iOS 26 is available, and only to navigation-layer chrome, not content cards.

## Not built yet

Chapters, full quest proposals UI, notifications, settings beyond sign-out,
and everything else in the RN app's later feature set (Diary v1 typography,
Nilo Variation dialogue devices, retention-design items). This is a first
pass proving the pipe end-to-end.

## CI

`.github/workflows/ios-build.yml` builds the `Arc` target on `macos-latest`
for the iOS Simulator on every push/PR touching `mobile/iOS/**`. There is no
local Mac in this workflow, so CI is the primary verification loop — push and
iterate against its output rather than expecting a first-try green build.
