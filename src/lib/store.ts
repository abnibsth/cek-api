/**
 * 💾 Penyimpanan API Key (Store)
 * ------------------------------
 * Mengelola simpan/baca API key dari file lokal: data/keys.json
 *
 * 🔒 Keamanan:
 *  - Key disimpan dalam keadaan TER-OBFUSCATE (XOR + base64)
 *    dengan kunci turunan dari nama komputer + user (machine-derived)
 *  - Bukan vault super aman — ini tool personal di localhost.
 *    Tapi mencegah key terbaca polos dari file.
 *
 * Fungsi utama:
 *  - listKeys()    → list key versi MASKED (aman dikirim ke browser)
 *  - getRawKey(id) → ambil key ASLI (hanya dipakai server-side)
 *  - getAllRawKeys → ambil semua key asli (untuk pengecekan massal)
 *  - addKey()      → simpan key baru (otomatis di-obfuscate)
 *  - deleteKey(id) → hapus key
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ApiKeyEntry, ApiKeysFile } from "./types";
import { encryptSecret, decryptSecret } from "./encrypt";

/**
 * Persistent storage for API keys.
 *
 * Keys are stored in a local JSON file OUTSIDE the public web root,
 * and are encrypted at rest (AES-256-GCM) using a key derived from
 * AUTH_SECRET. This is a personal tool running on localhost — not a
 * hardened vault — but it prevents casual plaintext leakage.
 *
 * Legacy keys (XOR-obfuscated, no "aes:" prefix) are auto-migrated
 * to AES the first time they are read.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const KEYS_FILE = path.join(DATA_DIR, "keys.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readFile(): ApiKeysFile {
  try {
    if (!fs.existsSync(KEYS_FILE)) return { keys: [] };
    const raw = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")) as ApiKeysFile;
    return { keys: raw.keys ?? [] };
  } catch {
    return { keys: [] };
  }
}

function writeFile(data: ApiKeysFile) {
  ensureDataDir();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2), "utf8");
}

/** Mask a key for display: sk-abc12345...xyz */
export function maskKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

/**
 * Baca file + migrasi otomatis: key lama (XOR, tanpa prefix "aes:")
 * langsung dienkripsi ulang ke AES-256-GCM saat dibaca.
 */
function readFileWithMigration(): ApiKeysFile {
  const file = readFile();
  let migrated = false;
  for (const k of file.keys) {
    if (k.key && !k.key.startsWith("aes:")) {
      try {
        k.key = encryptSecret(decryptSecret(k.key));
        migrated = true;
      } catch {
        // key lama gagal dibaca — biarkan apa adanya
      }
    }
  }
  if (migrated) writeFile(file);
  return file;
}

/** Public-safe list of keys (no raw keys, masked only) */
export function listKeys() {
  const file = readFileWithMigration();
  return file.keys.map((k) => ({
    id: k.id,
    providerId: k.providerId,
    label: k.label,
    baseUrl: k.baseUrl,
    maskedKey: maskKey(k.key.startsWith("aes:") ? decryptSecret(k.key) : k.key),
    createdAt: k.createdAt,
  }));
}

export function getRawKey(id: string): ApiKeyEntry | undefined {
  const file = readFileWithMigration();
  const entry = file.keys.find((k) => k.id === id);
  if (!entry) return undefined;
  return { ...entry, key: decryptSecret(entry.key) };
}

export function getAllRawKeys(): ApiKeyEntry[] {
  const file = readFileWithMigration();
  return file.keys.map((k) => ({ ...k, key: decryptSecret(k.key) }));
}

export function addKey(input: {
  providerId: string;
  label?: string;
  key: string;
  baseUrl?: string;
}): ApiKeyEntry {
  const file = readFile();
  const entry: ApiKeyEntry = {
    id: crypto.randomUUID(),
    providerId: input.providerId as ApiKeyEntry["providerId"],
    label: input.label?.trim() || input.providerId,
    key: encryptSecret(input.key.trim()),
    ...(input.baseUrl?.trim() ? { baseUrl: input.baseUrl.trim() } : {}),
    createdAt: new Date().toISOString(),
  };
  file.keys.push(entry);
  writeFile(file);
  return entry;
}

export function deleteKey(id: string): boolean {
  const file = readFile();
  const before = file.keys.length;
  file.keys = file.keys.filter((k) => k.id !== id);
  writeFile(file);
  return file.keys.length < before;
}
