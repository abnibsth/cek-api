/**
 * 💾 Penyimpanan API Key (Store) — Supabase Edition
 * ------------------------------------------------
 * Sebelumnya: baca/tulis file data/keys.json (fs)
 * Sekarang:   baca/tulis via Supabase REST API (db.ts)
 *
 * 🔒 Keamanan:
 *  - Key disimpan TER-enkripsi (AES-256-GCM) di kolom `key`
 *  - Kunci turunan dari AUTH_SECRET (tetap sama, nggak berubah)
 *
 * Semua fungsi sekarang ASYNC — route handler harus await.
 */
import crypto from "node:crypto";
import type { ApiKeyEntry } from "./types";
import { encryptSecret, decryptSecret } from "./encrypt";
import { dbListKeys, dbGetKey, dbAddKey, dbDeleteKey } from "./db";

/** Mask a key for display: sk-abc12345...xyz */
export function maskKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

/** Public-safe list of keys (no raw keys, masked only) */
export async function listKeys() {
  const entries = await dbListKeys();
  return entries.map((k) => ({
    id: k.id,
    providerId: k.providerId,
    label: k.label,
    baseUrl: k.baseUrl,
    maskedKey: maskKey(
      k.key.startsWith("aes:") ? decryptSecret(k.key) : k.key
    ),
    createdAt: k.createdAt,
  }));
}

export async function getRawKey(id: string): Promise<ApiKeyEntry | undefined> {
  const entry = await dbGetKey(id);
  if (!entry) return undefined;
  return { ...entry, key: decryptSecret(entry.key) };
}

export async function getAllRawKeys(): Promise<ApiKeyEntry[]> {
  const entries = await dbListKeys();
  return entries.map((k) => ({ ...k, key: decryptSecret(k.key) }));
}

export async function addKey(input: {
  providerId: string;
  label?: string;
  key: string;
  baseUrl?: string;
}): Promise<ApiKeyEntry> {
  const entry: ApiKeyEntry = {
    id: crypto.randomUUID(),
    providerId: input.providerId as ApiKeyEntry["providerId"],
    label: input.label?.trim() || input.providerId,
    key: encryptSecret(input.key.trim()),
    ...(input.baseUrl?.trim() ? { baseUrl: input.baseUrl.trim() } : {}),
    createdAt: new Date().toISOString(),
  };
  await dbAddKey(entry);
  return entry;
}

export async function deleteKey(id: string): Promise<boolean> {
  await dbDeleteKey(id);
  return true;
}
