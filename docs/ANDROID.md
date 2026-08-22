# Flowdesk Android (Capacitor)

Capacitor wrapper that loads your hosted Flowdesk URL (same data as the web PWA).

## Prerequisites

- [Android Studio](https://developer.android.com/studio) (SDK + platform tools)
- JDK 17+
- Flowdesk running somewhere reachable (local LAN or Vercel)

## Configure URL

Production (current):

```powershell
$env:FLOWDESK_URL = "https://flowdesk-banik.vercel.app"
npm run android:sync
```

Or set `FLOWDESK_URL` in `.env` and run `npm run android:apk`.

Default in config falls back to LAN only if `FLOWDESK_URL` is unset.

## Run / build

```powershell
npm run android:open     # open in Android Studio
npm run android:apk      # debug APK via Gradle
```

Built APK (after `npm run android:apk`):

- `android/app/build/outputs/apk/debug/app-debug.apk`
- Copy also at `dist-android/Flowdesk-debug.apk`

Requires JDK **21** and Android SDK 36. A portable JDK under
`%LOCALAPPDATA%\Java\jdk-21.0.12+8` is picked up automatically.

## Install on phone

1. Enable **Install unknown apps** for your file manager/browser.
2. Copy the APK to the phone and open it.
3. Sign in with the same account as the website.

## Notes

- Needs internet (or LAN) — this is not an offline SQLite build.
- **Notifications on APK:** uses Capacitor **local notifications** (not web push).
  Allow notification permission when prompted. While the app is open (or after
  opening), Flowdesk schedules the next ~6 hours of reminders on-device so they
  can fire with the app in the background. For longer gaps, enable **email
  alerts** on Account, or open the app periodically.
- **Weather on APK:** uses Capacitor **geolocation**. Allow location when prompted
  so Today shows your local forecast (not a city fallback).
- Web push still works best in Chrome as a PWA.
