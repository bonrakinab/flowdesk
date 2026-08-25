# Dictionary Feature

The dictionary feature in Flowdesk aggregates definitions from multiple English dictionary sources to provide comprehensive word meanings.

## Supported Dictionary Sources

### 1. Free Dictionary API (Default)
- **API**: https://dictionaryapi.dev
- **Cost**: Free, no API key required
- **Coverage**: Aggregates from multiple sources including Wiktionary
- **Automatically enabled**

### 2. Merriam-Webster Collegiate Dictionary (Optional)
- **API**: https://dictionaryapi.com
- **Cost**: Free tier available with API key
- **Coverage**: Professional dictionary with concise definitions
- **Setup**:
  1. Create a free account at https://dictionaryapi.com/account/register
  2. Get your API key from the dashboard
  3. Add to `.env`: `MERRIAM_WEBSTER_API_KEY=your-key-here`

### 3. Wordnik (Optional)
- **API**: https://www.wordnik.com/signup
- **Cost**: Free tier available (up to 15,000 requests/hour)
- **Coverage**: Multiple dictionary sources with attribution
- **Setup**:
  1. Create a free account at https://www.wordnik.com/signup
  2. Get your API key from https://www.wordnik.com/users/apiKey
  3. Add to `.env`: `WORDNIK_API_KEY=your-key-here`

### Future Sources (Commercial APIs)

These require paid subscriptions and are not currently integrated:

- **Oxford Dictionary API**: Requires paid subscription
- **Cambridge Dictionary API**: No public API available
- **Collins Dictionary API**: Requires paid subscription

## How It Works

When you look up a word:

1. The dictionary API queries all available sources in parallel
2. Results are merged and deduplicated by part of speech
3. Each definition shows its source (e.g., `[Merriam-Webster]`, `[Free Dictionary]`)
4. Up to 8 definitions per part of speech are shown
5. Synonyms from all sources are combined (up to 16 per part of speech)

## Environment Variables

Add these to your `.env` file (optional - only for enhanced coverage):

```bash
# Optional: Merriam-Webster Collegiate Dictionary
MERRIAM_WEBSTER_API_KEY=your-merriam-webster-key

# Optional: Wordnik API
WORDNIK_API_KEY=your-wordnik-key
```

The dictionary will work with just the Free Dictionary API if no keys are provided.

## Usage

### In Poems Page

1. Select a word in your poem
2. Press `Ctrl+D` (Windows/Linux) or `⌘+D` (Mac)
3. The dictionary panel shows definitions from multiple sources
4. Click on synonyms to look them up or insert them into your poem

### Features

- **Multi-source aggregation**: See definitions from multiple dictionaries
- **Source attribution**: Each definition shows which dictionary it came from
- **Synonyms**: Click to insert or right-click to look up
- **Bangla support**: Switch to বাংলা mode for English-to-Bangla translations
- **Offline-friendly**: Results are cached for 24 hours

## API Rate Limits

- Free Dictionary API: No documented limits
- Merriam-Webster: 1,000 queries/day (free tier)
- Wordnik: 15,000 requests/hour (free tier)

Cached results help stay well under these limits for typical usage.
