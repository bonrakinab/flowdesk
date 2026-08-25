# Google Health API - Vercel Deployment Guide

## Required environment variables

Configure these in Vercel under **Project → Settings → Environment Variables** for Production, Preview, and Development as appropriate:

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | Your Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth client secret |
| `NEXTAUTH_URL` | `https://flowdesk-banik.vercel.app` |

Never commit the client secret to the repository.

## Google Cloud redirect URIs

Add the deployed callback URLs under **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs**:

```text
https://flowdesk-banik.vercel.app/api/fitness/callback
https://flowdesk-rose.vercel.app/api/fitness/callback
```

## Deploy

After saving environment variables, trigger a new production deployment from Vercel or push a commit to `main` if Git integration is enabled.

## Test

1. Sign in to Flowdesk.
2. Open `/health` or use **More → Health** on mobile.
3. Click **Connect Google Health**.
4. Complete Google OAuth.
5. Click **Sync Now**.

## Troubleshooting

### Health link is missing
- Confirm production is deployed from the latest `main` commit.
- Confirm `src/app/(app)/health/page.tsx` exists in the deployed revision.
- On mobile, open **More → Health**.

### Redirect URI mismatch
- Confirm the callback URI in Google Cloud exactly matches the deployed Flowdesk hostname.
- Use HTTPS and no trailing slash.

### Not connected after OAuth
- Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present in the production Vercel environment.
- Redeploy after changing environment variables.
- Verify the database is available and the fitness tables exist.

### Access blocked
- If the OAuth consent screen is still in Testing, add the intended Google account as a test user.
