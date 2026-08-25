# ✅ READY TO DEPLOY - Copy & Paste Instructions

## Your Vercel URLs
- **Primary**: https://flowdesk-banik.vercel.app
- **Secondary**: https://flowdesk-rose.vercel.app

---

## 🔥 STEP 1: Add Environment Variables in Vercel

Go to: https://vercel.com/dashboard → Select "flowdesk" project → Settings → Environment Variables

**Add these 3 variables** (click "Add New" for each):

### Variable 1:
```
Name: GOOGLE_CLIENT_ID
Value: 107915318175-r69aeejmsimlicms09qsftdl37efk9bc.apps.googleusercontent.com
Environment: Production, Preview, Development
```

### Variable 2:
```
Name: GOOGLE_CLIENT_SECRET
Value: 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
Environment: Production, Preview, Development
```

### Variable 3:
```
Name: NEXTAUTH_URL
Value: https://flowdesk-banik.vercel.app
Environment: Production, Preview, Development
```

Click **Save** after each one.

---

## 🔥 STEP 2: Add Redirect URIs in Google Cloud Console

Go to: https://console.cloud.google.com/apis/credentials

1. Click on your OAuth 2.0 Client ID: **107915318175-r69aeejmsimlicms09qsftdl37efk9bc.apps.googleusercontent.com**
2. Scroll to **Authorized redirect URIs**
3. Click **ADD URI** button
4. **Add these 2 URIs** (one at a time):

```
https://flowdesk-banik.vercel.app/api/fitness/callback
```

```
https://flowdesk-rose.vercel.app/api/fitness/callback
```

5. Click **SAVE** at the bottom

---

## 🔥 STEP 3: Redeploy

Go to: https://vercel.com/dashboard → flowdesk project → Deployments

1. Click the **•••** (three dots) on the latest deployment
2. Click **Redeploy**
3. Wait for deployment to complete (~2 minutes)

---

## 🎉 STEP 4: Test Your Google Health Integration!

### Primary URL:
1. Go to: **https://flowdesk-banik.vercel.app/health**
2. Click **"Connect Google Health"** button
3. Sign in with your Google account
4. Grant the fitness permissions (you'll see the 5 scopes you added)
5. You'll be redirected back to the Health page
6. Click **"Sync Now"** to fetch your last 30 days of fitness data
7. **DONE!** 🎊 Your stats should appear!

### What You'll See:
- 📈 **Steps** with 7-day average
- 🗺️ **Distance** traveled (km)
- 🔥 **Calories** burned
- ⏱️ **Active Minutes**
- ❤️ **Heart Rate** (avg, min, max)
- 🌙 **Sleep** duration (hours)
- 📊 **Weekly step chart**
- 🎯 **Trend indicators** (↑↓→)

---

## 🐛 If Something Goes Wrong

### "Redirect URI Mismatch" Error
✅ Double-check the URIs in Google Cloud match exactly:
- `https://flowdesk-banik.vercel.app/api/fitness/callback`
- `https://flowdesk-rose.vercel.app/api/fitness/callback`
- No trailing slash!

### "Not Connected" After OAuth
✅ Check Vercel environment variables are saved
✅ Make sure you redeployed after adding variables
✅ Check Vercel deployment logs for errors

### "Access Blocked" Error
✅ Make sure you added your email as a **Test User** in Google Cloud Console (OAuth consent screen → Test users)

### No Data Showing
✅ Make sure you have Google Fit app installed and tracking data
✅ Try clicking "Sync Now" again
✅ Check that you granted all 5 permissions during OAuth

---

## 📋 Quick Checklist

- [ ] Add 3 environment variables in Vercel (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL)
- [ ] Add 2 redirect URIs in Google Cloud Console
- [ ] Redeploy in Vercel
- [ ] Visit /health page and click "Connect Google Health"
- [ ] Grant permissions
- [ ] Click "Sync Now"
- [ ] See your fitness data! 🎉

---

## 🎯 All Set!

Everything is ready to go. Just follow the 4 steps above and you'll have your Google Health integration working in about 5 minutes!

**Your health dashboard will be live at:**
- https://flowdesk-banik.vercel.app/health
- https://flowdesk-rose.vercel.app/health

---

Generated on: 2026-08-25
