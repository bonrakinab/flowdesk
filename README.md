# Flowdesk

Local CRM for tickets, calendar, notes, reminders, finance, meds, and focus.

**Live:** [https://flowdesk-banik.vercel.app](https://flowdesk-banik.vercel.app) (also [flowdesk-rose.vercel.app](https://flowdesk-rose.vercel.app))

## Quick start (local)

```bash
cd flowdesk
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the same Neon `DATABASE_URL` from `.env` (copied from Vercel/Neon).

### Demo login (after seed)

| User | Email | Password |
|------|-------|----------|
| Alex | `alex@flowdesk.local` | `password123` |
| Sam  | `sam@flowdesk.local`  | `password123` |

Household invite code: `FAMILY`

## Deploy

- Host: Vercel project `flowdesk`
- DB: Neon (`flowdesk-db`) via Vercel Marketplace
- Android APK loads `FLOWDESK_URL` (production: `https://flowdesk-banik.vercel.app`) — see [docs/ANDROID.md](docs/ANDROID.md)

Google OAuth: add redirect URIs in Google Cloud Console:  
`https://flowdesk-banik.vercel.app/api/auth/callback/google`  
`https://flowdesk-rose.vercel.app/api/auth/callback/google`

Hobby Vercel has no frequent Cron — use in-app alerts while the app is open, or hit `/api/cron/alerts` with `Authorization: Bearer $CRON_SECRET` from an external scheduler.

## Features

- Auth (email/password, optional Google OAuth)
- Household invite codes
- Today Radar, Board, List, Inbox
- Calendar (tickets, events, meds, reminders, BD holidays)
- Notes, Pomodoro, People, Projects, Templates
- Finance (cashflow, budgets, savings, BD tax)
- Meds + push/email alerts
- ⌘K command palette, PWA
- Agent (Gemini chat — confirm before writes; needs `GEMINI_API_KEY`)
- Android app (Capacitor shell — see [docs/ANDROID.md](docs/ANDROID.md))

## Environment

Copy `.env.example` to `.env`:

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="change-me-to-a-long-random-string"
AUTH_TRUST_HOST="true"
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

### Google sign-in (optional)

1. Create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/)
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env`
4. Restart `npm run dev`

### Agent (Gemini)

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey)
2. Set `GEMINI_API_KEY` in `.env` (local) and in the Vercel project env
3. Optional: `GEMINI_MODEL` (default `gemini-3.6-flash`)
4. Open **More → Agent** (or ⌘K → Go to Agent). If you hit 429 quota errors, wait a minute or enable billing in AI Studio.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev (Turbopack) |
| `npm run dev:pwa` | Dev with service worker |
| `npm run build` / `npm start` | Production |
| `npm run db:seed` | Demo data |
| `npm run db:migrate` | Migrations |
| `npm run alerts:tick` | Dispatch due alerts |
| `npm run android:sync` | Sync Capacitor Android project |
| `npm run android:open` | Open in Android Studio |
| `npm run android:apk` | Build debug APK (needs Android SDK) |

## Stack

Next.js 15 · TypeScript · Tailwind · Prisma/SQLite · Auth.js · Capacitor (Android) · Framer Motion · dnd-kit · Tiptap · Serwist
