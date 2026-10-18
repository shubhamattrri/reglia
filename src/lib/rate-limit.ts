type Bucket = { count: number; resetAt: number };

const g = globalThis as typeof globalThis & { __regaliaRateLimit?: Map<string, Bucket> };
const buckets = (g.__regaliaRateLimit ??= new Map<string, Bucket>());

/** Fixed-window in-memory limiter (per server process). Returns seconds to wait when blocked. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false as const, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true as const };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
