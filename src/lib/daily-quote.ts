/** Stable daily quote — same for everyone on a given calendar day. */

export type DailyQuote = {
  text: string;
  author: string;
};

const QUOTES: DailyQuote[] = [
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    text: "What you do today can improve all your tomorrows.",
    author: "Ralph Marston",
  },
  {
    text: "Small deeds done are better than great deeds planned.",
    author: "Peter Marshall",
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "Start where you are. Use what you have. Do what you can.",
    author: "Arthur Ashe",
  },
  {
    text: "Well done is better than well said.",
    author: "Benjamin Franklin",
  },
  {
    text: "Keep your face always toward the sunshine, and shadows will fall behind you.",
    author: "Walt Whitman",
  },
  {
    text: "The best time to plant a tree was 20 years ago. The second best time is now.",
    author: "Chinese proverb",
  },
  {
    text: "Do what you can, with what you have, where you are.",
    author: "Theodore Roosevelt",
  },
  {
    text: "Happiness is not something ready made. It comes from your own actions.",
    author: "Dalai Lama",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
  },
  {
    text: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt",
  },
  {
    text: "The future depends on what you do today.",
    author: "Mahatma Gandhi",
  },
  {
    text: "In the middle of every difficulty lies opportunity.",
    author: "Albert Einstein",
  },
  {
    text: "A journey of a thousand miles begins with a single step.",
    author: "Lao Tzu",
  },
  {
    text: "Quality is not an act, it is a habit.",
    author: "Aristotle",
  },
  {
    text: "You miss 100% of the shots you don't take.",
    author: "Wayne Gretzky",
  },
  {
    text: "The only impossible journey is the one you never begin.",
    author: "Tony Robbins",
  },
  {
    text: "Act as if what you do makes a difference. It does.",
    author: "William James",
  },
  {
    text: "Courage is not the absence of fear, but rather the judgment that something else is more important than fear.",
    author: "Ambrose Redmoon",
  },
  {
    text: "Try to be a rainbow in someone's cloud.",
    author: "Maya Angelou",
  },
  {
    text: "Wherever you go, go with all your heart.",
    author: "Confucius",
  },
  {
    text: "The family is one of nature's masterpieces.",
    author: "George Santayana",
  },
  {
    text: "What we have once enjoyed we can never lose. All that we love deeply becomes a part of us.",
    author: "Helen Keller",
  },
  {
    text: "Home is where love resides, memories are created, friends always belong, and laughter never ends.",
    author: "Unknown",
  },
  {
    text: "The love of family and the admiration of friends is much more important than wealth and privilege.",
    author: "Charles Kuralt",
  },
  {
    text: "Be yourself; everyone else is already taken.",
    author: "Oscar Wilde",
  },
  {
    text: "Life is what happens when you're busy making other plans.",
    author: "John Lennon",
  },
  {
    text: "Spread love everywhere you go. Let no one ever come to you without leaving happier.",
    author: "Mother Teresa",
  },
  {
    text: "The greatest glory in living lies not in never falling, but in rising every time we fall.",
    author: "Nelson Mandela",
  },
  {
    text: "If you want to lift yourself up, lift up someone else.",
    author: "Booker T. Washington",
  },
  {
    text: "Kindness is a language which the deaf can hear and the blind can see.",
    author: "Mark Twain",
  },
  {
    text: "Yesterday is gone. Tomorrow has not yet come. We have only today. Let us begin.",
    author: "Mother Teresa",
  },
  {
    text: "Nothing is particularly hard if you divide it into small jobs.",
    author: "Henry Ford",
  },
  {
    text: "Peace begins with a smile.",
    author: "Mother Teresa",
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
  },
  {
    text: "Optimism is the faith that leads to achievement.",
    author: "Helen Keller",
  },
  {
    text: "You are never too old to set another goal or to dream a new dream.",
    author: "C.S. Lewis",
  },
  {
    text: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle",
  },
  {
    text: "The best preparation for tomorrow is doing your best today.",
    author: "H. Jackson Brown Jr.",
  },
  {
    text: "Fall seven times, stand up eight.",
    author: "Japanese proverb",
  },
  {
    text: "A day without laughter is a day wasted.",
    author: "Charlie Chaplin",
  },
  {
    text: "Love and work are the cornerstones of our humanness.",
    author: "Sigmund Freud",
  },
];

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function getDailyQuote(date = new Date()): DailyQuote {
  const idx = dayOfYear(date) % QUOTES.length;
  return QUOTES[idx]!;
}
