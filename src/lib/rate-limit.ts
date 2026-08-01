/**
 * 🚦 Rate Limit (Sederhana)
 * -------------------------
 * Pembatas jumlah request per IP dalam satu waktu — mencegah
 * spam & brute-force saat app di-deploy ke publik.
 *
 * Implementasi: in-memory Map (tanpa dependency).
 * - Key = IP + route
 * - Value = { count, resetAt }
 * - Kadaluarsa otomatis dibersihkan saat ada request baru
 *
 * Catatan: in-memory = reset tiap server restart. Cukup untuk
 * tool personal; kalau mau lebih serius, pakai Redis.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

function ipFromRequest(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Cek & catat request. Kalau melebihi limit → tolak.
 * @param key   route identifier (mis. "login" atau "api")
 * @param limit maksimum request dalam window
 * @param windowMs panjang jendela waktu (default 60 detik)
 */
export function rateLimit(
  request: Request,
  key: string,
  limit: number,
  windowMs = 60_000
): RateLimitResult {
  const ip = ipFromRequest(request);
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();

  const bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** Bersihkan bucket yang sudah kadaluarsa (dipanggil berkala) */
export function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
