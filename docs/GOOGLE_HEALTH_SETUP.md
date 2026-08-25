# Google Health API Integration Setup

This guide will help you set up Google Health API integration to track your fitness data in Flowdesk.

## Overview

The Google Health API integration allows you to:
- Track daily steps, distance, and calories burned
- Monitor heart rate statistics
- View sleep duration
- See activity trends over time

## Prerequisites

- A Google account with Google Fit or other fitness app data
- Access to [Google Cloud Console](https://console.cloud.google.com)

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Name your project (e.g., "Flowdesk Fitness")
4. Click **Create**

### 2. Enable Google Fitness API

1. In the Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Fitness API"
3. Click **Google Fitness API**
4. Click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click **Create**
4. Fill in the required fields:
   - **App name**: Flowdesk
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click **Save and Continue**

6. On the **Scopes** page, click **Add or Remove Scopes**
7. Add these scopes:
   - `https://www.googleapis.com/auth/fitness.activity.read`
   - `https://www.googleapis.com/auth/fitness.heart_rate.read`
   - `https://www.googleapis.com/auth/fitness.sleep.read`
   - `https://www.googleapis.com/auth/fitness.location.read`
   - `https://www.googleapis.com/auth/fitness.body.read`
8. Click **Update** and **Save and Continue**

9. On the **Test users** page (if in testing mode), add your Google account email
10. Click **Save and Continue**

### 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Name it (e.g., "Flowdesk Web")
5. Under **Authorized redirect URIs**, add:
   - For local development: `http://localhost:3000/api/fitness/callback`
   - For production: `https://your-domain.com/api/fitness/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### 5. Configure Environment Variables

Add these to your `.env.local` file:

```env
# Google OAuth (if not already set)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# NextAuth URL (required for OAuth redirect)
NEXTAUTH_URL=http://localhost:3000
# For production:
# NEXTAUTH_URL=https://your-domain.com
```

### 6. Update Database

Run the Prisma migration to add fitness tables:

```bash
npx prisma migrate dev
```

Or if you're using a cloud database, push the schema:

```bash
npx prisma db push
```

### 7. Restart Your Development Server

```bash
npm run dev
```

## Usage

### Connect Your Google Account

1. Navigate to the **Health** page in Flowdesk
2. Click **Connect Google Health**
3. Sign in with your Google account
4. Grant the requested permissions
5. You'll be redirected back to Flowdesk

### Sync Your Data

After connecting, click **Sync Now** to fetch your fitness data from the last 30 days.

The app will retrieve:
- Steps and distance walked
- Calories burned
- Active minutes
- Heart rate statistics
- Sleep duration

### View Your Statistics

The Health page displays:
- Today's stats with 7-day averages
- Trend indicators (up/down/stable)
- Weekly step chart
- Color-coded widgets for each metric

## Troubleshooting

### "Google OAuth not configured" Error

Make sure you've added `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to your `.env.local` file and restarted the dev server.

### "Failed to sync data" Error

1. Check that you've enabled the Google Fitness API in Cloud Console
2. Verify all scopes are added to the OAuth consent screen
3. Make sure you have fitness data in Google Fit or another connected app

### No Data Showing

1. Ensure you have a fitness tracking app (Google Fit, Samsung Health, etc.) that syncs to Google Fit
2. Verify the app has recorded data
3. Try syncing again with the **Sync Now** button

### OAuth Redirect Mismatch

Make sure your redirect URI in Google Cloud Console exactly matches:
- `http://localhost:3000/api/fitness/callback` (local)
- `https://your-domain.com/api/fitness/callback` (production)

### Access Denied During OAuth

If Google shows "Access blocked: This app's request is invalid":
1. Add your email to **Test users** in the OAuth consent screen
2. Or publish your app (for production use)

## Data Privacy

- Your fitness data is stored securely in your Flowdesk database
- OAuth tokens are encrypted and stored safely
- Only you can see your fitness data
- You can disconnect at any time by clicking **Disconnect** on the Health page

## Limitations

- Historical data is limited to what Google Fit provides (typically last 30 days)
- Sync is manual (click "Sync Now" to update)
- Some metrics may not be available if not tracked by your fitness app

## Next Steps

- Set up automatic daily syncing (coming soon)
- Export fitness data
- Connect other fitness services (Fitbit, Apple Health)

## Support

For issues or questions, please open an issue on the GitHub repository.
