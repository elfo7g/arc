# Arc iOS

SwiftUI native prototype for Arc.

## Open

Open this project on a Mac with Xcode:

```text
mobile/iOS/Arc.xcodeproj
```

Recommended first run:

1. Start the Web API server from `Web`.
2. In Xcode, choose an iPhone simulator.
3. Build and run the `Arc` scheme.

```powershell
cd C:\Users\g048fnu\Documents\The_Arc\Web
npm start
```

The iOS app reads `ArcAPIBaseURL` from `Arc/Info.plist`.

Default:

```text
http://localhost:4173
```

For a real iPhone, replace this with your Mac's LAN address, for example:

```text
http://192.168.1.20:4173
```

For a deployed backend, replace it with the production URL after `GEMINI_API_KEY` is configured there.

## Current Scope

- Native SwiftUI shell.
- Home / Journal / Quest / Story / Memory tabs.
- Night Ritual input flow backed by the local Web API.
- Journal entries saved to local `UserDefaults`.
- Quest tab kept as an exploration surface, not a daily checklist.
- Settings sheet with profile and day count.
- Nilo and Arc visual assets shared with the broader app.

## Retired

Daily task-style quests, daily quest generation, manual completion, and square quest tiles have been removed.

## Notes

This scaffold was created from Windows, so `xcodebuild` verification still needs to be run on macOS.
