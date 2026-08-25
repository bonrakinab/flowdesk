# Google Health API v4 production setup

Flowdesk Health uses the Google Health API v4 (`health.googleapis.com/v4`). The previous implementation used the deprecated Google Fit REST API and legacy `fitness.*` OAuth scopes.

## Google Cloud

1. Enable **Google Health API** in the Google Cloud project used by Flowdesk.
2. Configure the OAuth consent screen. While the app is in Testing, add the Flowdesk Google account under **Test users**.
3. Add only the read scopes Flowdesk uses:
   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
   - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
   - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
4. Add the production redirect URI to the Web OAuth client:
   - `https://flowdesk-banik.vercel.app/api/fitness/callback`
   - Add `https://flowdesk-rose.vercel.app/api/fitness/callback` only if the secondary deployment is still in use.

## Environment variables

Flowdesk prefers dedicated Health credentials when present:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

If those are not set, the Health routes fall back to the existing Auth.js Google credentials:

```env
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

Set the canonical application URL as well:

```env
NEXTAUTH_URL=https://flowdesk-banik.vercel.app
```

## Database

Production builds run `prisma migrate deploy`. The migration `20260825170000_google_health` creates the `FitnessConnection` and `FitnessData` tables that were previously present only in `schema.prisma`.

## Security

Never commit OAuth client secrets to Git. A Google OAuth secret was previously committed in `COPY_PASTE_INSTRUCTIONS.md`; rotate/revoke that credential in Google Cloud because deleting it from the latest revision does not erase it from Git history.

Google Health OAuth scopes are restricted. For a personal/test deployment, keep the OAuth app in Testing and add the intended account as a test user. Public production use has additional verification and security-review requirements.
