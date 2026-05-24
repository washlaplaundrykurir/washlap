/**
 * Simple in-memory rate limiter.
 * Cocok untuk Next.js serverless — reset setiap cold start.
 * Untuk production skala besar, ganti dengan Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Cek apakah request dari IP ini masih dalam batas.
 * @param ip - IP address dari request
 * @param limit - Maksimum request per window (default: 10)
 * @param windowMs - Durasi window dalam ms (default: 60 detik)
 */
export function rateLimit(
  ip: string,
  limit = 10,
  windowMs = 60_000,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    // Window baru atau sudah expired
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// Cleanup entries yang sudah expired setiap 5 menit
// agar memory tidak terus bertambah
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    Array.from(store.entries()).forEach(([key, entry]) => {
      if (now > entry.resetAt) store.delete(key);
    });
  }, 5 * 60_000);
}
