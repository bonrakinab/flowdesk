# Google Health API Integration Setup

Flowdesk uses the Google Health API v4 for steps, distance, total calories, active minutes, heart rate, and sleep.

## Google Cloud setup

1. Open Google Cloud Console and select the project used by Flowdesk.
2. Enable **Google Health API**.
3. Configure the OAuth consent screen. If the app is still in Testing, add the Flowdesk Google account as a test user.
4. Add these read-only Google Health scopes on the OAuth Data Access page:
   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
   - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
   - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
5. Use a **Web application** OAuth client.
6. Add the exact callback URI used by Flowdesk:
   - Local: `http://localhost:3000/api/fitness/callback`
   - Production: `https://<your-production-domain>/api/fitness/callback`

## Environment variables

The Health integration reuses the normal Flowdesk Google OAuth credentials when available:

```env
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_URL=https://<your-production-domain>
```

For a separate Health OAuth client, these optional overrides are also supported:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=https://<your-production-domain>
```

Do not commit OAuth secrets to the repository. If a client secret has ever been committed, rotate it in Google Cloud and replace the deployed environment variable.

## Database

The Google Health tables are created by the checked-in Prisma migration. Production deployments should run:

```bash
npx prisma migrate deploy
```

Flowdesk's production build is expected to apply migrations before the Next.js build.

## Usage

1. Open **More → Health**.
2. Select **Connect Google Health**.
3. Approve the requested Health permissions.
4. Flowdesk returns to `/health` and performs a sync.
5. Use **Sync Now** for later refreshes.

The sync requests the latest 14 days because Google Health limits daily rollup ranges for heart rate, active minutes, and total calories to 14 days. Previously stored data can still be displayed for longer periods.

## Troubleshooting

### Health is missing from the website

- Confirm the latest `main` commit deployed successfully.
- Check the production build for Prisma migration or TypeScript errors.
- If using an installed PWA, fully close and reopen it after a deployment; clear site data only if the old app shell remains cached.

### OAuth configuration error

- Confirm either `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` or `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` is set in the production environment.
- Confirm the callback URI exactly matches `/api/fitness/callback` on the deployed domain.
- Confirm Google Health API is enabled and the three scopes above are allowed for the OAuth client.

### Sync returns only some metrics

Google Health supports partial consent. Flowdesk keeps syncing any metrics the user approved instead of failing the whole sync. Reconnect Google Health and grant the missing permissions if desired.

### No data appears

Google Health only returns data that has reached the user's Google Health account from a supported source. Make sure the relevant tracker/app has synced first.

## Security

- OAuth state is protected with a short-lived HTTP-only cookie.
- The user identity is taken from the authenticated Flowdesk session, not from an OAuth query parameter.
- OAuth credentials belong only in deployment environment variables, never in committed files.
- Disconnecting removes the stored Google Health connection tokens but keeps already-synced daily health records.
