const hits = new Map<string, number[]>();

/** Simple per-user sliding window: max `limit` requests per `windowMs`. */
export function checkAgentRateLimit(
  userId: string,
  limit = 20,
  windowMs = 60_000
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const prev = (hits.get(userId) || []).filter((t) => now - t < windowMs);
  if (prev.length >= limit) {
    const oldest = prev[0] ?? now;
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }
  prev.push(now);
  hits.set(userId, prev);
  return { ok: true };
}
