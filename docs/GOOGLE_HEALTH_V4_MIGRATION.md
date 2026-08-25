# Google Health API v4

Flowdesk Health uses the Google Health API v4, not the deprecated Google Fit REST API.

## Google Cloud setup

1. Enable the **Google Health API** for the Google Cloud project used by Flowdesk.
2. Configure the OAuth consent screen and add the Flowdesk account as a test user while the app is in testing.
3. The OAuth Web client must allow these redirect URIs:
   - `https://flowdesk-banik.vercel.app/api/fitness/callback`
   - `https://flowdesk-rose.vercel.app/api/fitness/callback` (only if the secondary deployment is still used)
4. Configure credentials in Vercel. Flowdesk will use `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` when provided and otherwise fall back to the existing `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` values.

## Required read scopes

- `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
- `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
- `https://www.googleapis.com/auth/googlehealth.sleep.readonly`

## Security

Never commit OAuth client secrets to the repository. A credential was previously placed in a repository instruction file; that credential must be revoked/rotated in Google Cloud because removing it from the current branch does not remove it from Git history.
