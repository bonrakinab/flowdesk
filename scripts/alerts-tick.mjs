/**
 * Poll Flowdesk alert dispatcher (for when the browser is closed).
 * Usage: node scripts/alerts-tick.mjs
 * Requires CRON_SECRET and a running server (npm run dev / start).
 */
const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;

async function tick() {
  if (!secret) {
    console.error("Set CRON_SECRET in .env");
    process.exit(1);
  }
  const res = await fetch(`${base}/api/cron/alerts`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  console.log(res.status, text);
}

tick().catch((e) => {
  console.error(e);
  process.exit(1);
});
