# Google Health API - Vercel Deployment Guide

## Your Google OAuth Credentials

```
Client ID: 107915318175-r69aeejmsimlicms09qsftdl37efk9bc.apps.googleusercontent.com
Client Secret: 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
```

## Step 1: Add Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **flowdesk** project
3. Click **Settings** → **Environment Variables**
4. Add these variables (click "Add New" for each):

### Required Variables:

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | `107915318175-r69aeejmsimlicms09qsftdl37efk9bc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `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` |
| `NEXTAUTH_URL` | Your full deployment URL (e.g., `https://flowdesk.vercel.app`) |

5. Make sure to select **Production**, **Preview**, and **Development** for each variable
6. Click **Save** for each one

## Step 2: Add Authorized Redirect URI in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID: `107915318175-r69aeejmsimlicms09qsftdl37efk9bc.apps.googleusercontent.com`
4. Under **Authorized redirect URIs**, click **ADD URI**
5. Add your production URL:
   ```
   https://your-domain.vercel.app/api/fitness/callback
   ```
   Replace `your-domain` with your actual Vercel deployment URL
6. Click **SAVE**

## Step 3: Redeploy

After adding environment variables:

1. In Vercel, go to **Deployments**
2. Click the three dots (**•••**) on your latest deployment
3. Click **Redeploy**

Or simply push a new commit to trigger deployment.

## Step 4: Test the Integration

1. Visit `https://your-domain.vercel.app/health`
2. Click **Connect Google Health**
3. Sign in with your Google account
4. Grant the fitness permissions
5. You'll be redirected back
6. Click **Sync Now** to fetch your fitness data

## What You Need From Your Vercel Dashboard

To complete the setup, I need your:
- **Production URL** (e.g., `flowdesk.vercel.app` or custom domain)

Once you provide this, I'll update the redirect URI instructions above.

## Troubleshooting

### "Redirect URI Mismatch" Error
- Make sure the redirect URI in Google Cloud exactly matches: `https://your-domain.vercel.app/api/fitness/callback`
- No trailing slash
- Must use HTTPS (http won't work in production)

### "Access Blocked" Error
- Make sure you added your email as a Test User in Google Cloud Console
- Or publish the app (move from Testing to Production)

### "Not Connected" After OAuth
- Check that environment variables are set in Vercel
- Verify database is accessible (check Vercel logs)
- Ensure you redeployed after adding environment variables
