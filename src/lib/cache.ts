/**
 * 🗃️ Cache Hasil Pengecekan — In-Memory Edition
 * ------------------------------------------------
 * Sebelumnya: simpan ke data/cache.json (fs)
 * Sekarang:   in-memory Map (lebih cepat, nggak butuh disk)
 *
 * Cache 5 menit cukup di memory — kalau server restart, cek ulang aja.
 * Untuk app serverless (Vercel), tiap cold start dapat memory baru = cache kosong = cek ulang. Itu OK.
 *
 * - getCached(keyId) → ambil hasil tersimpan jika masih fresh
 * - setCached(keyId, result) → simpan hasil baru
 * - TTL default: 5 MENIT
 */
import type { CacheEntry, CheckResult } from "./types";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Versi skema cache. Naikkan kalau logika pengecekan berubah. */
const CACHE_VERSION = 4;

const store = new Map<string, CacheEntry>();

/** Get a cached result for a key id if fresh */
export function getCached(keyId: string, ttlMs = DEFAULT_TTL_MS): CheckResult | null {
  const entry = store.get(keyId);
  if (!entry) return null;
  const age = Date.now() - new Date(entry.cachedAt).getTime();
  if (age > ttlMs) return null;
  return entry.result;
}

export function setCached(keyId: string, result: CheckResult) {
  const entry: CacheEntry = {
    keyId,
    providerId: result.providerId,
    label: result.label,
    result,
    cachedAt: new Date().toISOString(),
  };
  store.set(keyId, entry);
}

/** Hapus cache untuk key tertentu (dipanggil saat key dihapus) */
export function clearCached(keyId: string) {
  store.delete(keyId);
}

// Export CACHE_VERSION untuk kompatibilitas (kalau ada yang baca)
export { CACHE_VERSION as CACHE_VERSION };
