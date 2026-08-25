# Quick Dictionary API Setup

## Merriam-Webster (2 minutes)

### Step 1: Sign Up
1. Go to: **https://dictionaryapi.com/account/register**
2. Fill in:
   - Email
   - Password
   - Accept terms

### Step 2: Get Your Key
1. After signing up, you'll see your dashboard
2. Or go directly to: **https://dictionaryapi.com/account/my-keys**
3. Look for **"Collegiate Dictionary"** key
4. Click to reveal and copy the key (looks like: `12345678-1234-1234-1234-123456789abc`)

### Step 3: Add to Project
1. Open `.env.local` in your project root
2. Replace `your-api-key-here` with your actual key:
   ```
   MERRIAM_WEBSTER_API_KEY=12345678-1234-1234-1234-123456789abc
   ```
3. Save the file

### Step 4: Restart Dev Server
```bash
npm run dev
```

### Step 5: Test It!
1. Go to the Poems page
2. Type some text
3. Select a word
4. Press `Ctrl+D` (Windows) or `⌘+D` (Mac)
5. You should see definitions from multiple sources including `[Merriam-Webster]`!

## What You Get

✅ **Concise, professional definitions** from Merriam-Webster Collegiate Dictionary  
✅ **Source attribution** - see which dictionary each definition came from  
✅ **Merged results** - combines with Free Dictionary API automatically  
✅ **1,000 free lookups per day** - plenty for personal use  
✅ **No credit card required** - completely free tier

## Optional: Add Wordnik Too

For even more comprehensive coverage:

1. Sign up at: **https://www.wordnik.com/signup**
2. Get your API key from: **https://www.wordnik.com/users/apiKey**
3. Add to `.env.local`:
   ```
   WORDNIK_API_KEY=your-wordnik-key
   ```
4. Restart: `npm run dev`

Wordnik free tier: **15,000 requests per hour** 🎉

## Troubleshooting

**"Dictionary lookup failed"**
- Check that your API key is correctly copied (no extra spaces)
- Make sure you restarted the dev server after adding the key
- Verify the key is for "Collegiate Dictionary" not other products

**"Not seeing [Merriam-Webster] labels"**
- Clear your browser cache
- Check browser console for any errors
- The dictionary falls back to Free Dictionary API if the key is invalid

**Rate limit errors**
- Free tier: 1,000 queries/day
- Each word lookup counts as 1 query
- Results are cached for 24 hours, so repeated lookups don't count

## Need Help?

- Merriam-Webster support: https://dictionaryapi.com/info/faq
- Check `/docs/DICTIONARY.md` for full documentation
