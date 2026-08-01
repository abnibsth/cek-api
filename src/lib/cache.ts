/**
 * 🗃️ Cache Hasil Pengecekan
 * --------------------------
 * Menyimpan hasil cek ke data/cache.json supaya TIDAK spam
 * API provider setiap kali halaman di-refresh.
 *
 * - getCached(keyId) → ambil hasil tersimpan jika masih fresh
 * - setCached(keyId, result) → simpan hasil baru
 * - TTL default: 5 MENIT — setelah itu dianggap basi, cek ulang
 *
 * Alur di /api/check:
 *  - Ada cache fresh → langsung pakai (cepat, tanpa request keluar)
 *  - Cache basi/tidak ada → cek ulang ke provider, simpan lagi
 *  - ?refresh=1 → abaikan cache, paksa cek baru (tombol "Cek Sekarang")
 */
import fs from "node:fs";
import path from "node:path";
import type { CacheEntry, CacheFile, CheckResult } from "./types";

/**
 * Cache check results to disk so we don't hammer provider APIs
 * on every page load. Default TTL: 5 minutes.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "cache.json");
const DEFAULT_TTL_MS = 5 * 60 * 1000;
/**
 * Versi skema cache. Naikkan angka ini SETIAP kali logika pengecekan
 * berubah (mis. perbaikan fallback /v1, max_tokens, dll) supaya
 * hasil lama yang "error" tidak dipakai lagi.
 */
const CACHE_VERSION = 4;

function readCache(): CacheFile {
  try {
    if (!fs.existsSync(CACHE_FILE)) return { version: CACHE_VERSION, entries: [] };
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as CacheFile;
    // Versi beda → cache lama tidak valid, anggap kosong
    if (raw.version !== CACHE_VERSION) return { version: CACHE_VERSION, entries: [] };
    return { version: raw.version, entries: raw.entries ?? [] };
  } catch {
    return { version: CACHE_VERSION, entries: [] };
  }
}

function writeCache(data: CacheFile) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf8");
}

/** Get a cached result for a key id if fresh */
export function getCached(keyId: string, ttlMs = DEFAULT_TTL_MS): CheckResult | null {
  const cache = readCache();
  const entry = cache.entries.find((e) => e.keyId === keyId);
  if (!entry) return null;
  const age = Date.now() - new Date(entry.cachedAt).getTime();
  if (age > ttlMs) return null;
  return entry.result;
}

export function setCached(keyId: string, result: CheckResult) {
  const cache = readCache();
  const entry: CacheEntry = {
    keyId,
    providerId: result.providerId,
    label: result.label,
    result,
    cachedAt: new Date().toISOString(),
  };
  cache.entries = cache.entries.filter((e) => e.keyId !== keyId);
  cache.entries.push(entry);
  writeCache(cache);
}
