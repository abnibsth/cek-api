/**
 * 🔒 Enkripsi API Key (AES-256-GCM)
 * ---------------------------------
 * Menggantikan obfuscation XOR lama dengan enkripsi sungguhan.
 *
 * Alur migrasi otomatis:
 *  - File keys.json lama berisi nilai XOR (base64, tanpa prefix)
 *  - File baru akan disimpan dengan prefix "aes:" + IV + tag + cipher
 *  - Saat baca, nilai tanpa prefix dianggap XOR lama → didekripsi
 *    dengan metode lama, lalu ditulis ulang sebagai AES (migrasi)
 *
 * Env var:
 *  - AUTH_SECRET : kunci turunan untuk enkripsi (WAJIB diisi)
 */
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "aes:";

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET belum diatur. Set di .env (minimal 16 karakter random), lalu restart server."
    );
  }
  // Derive 32-byte key dari secret (stabil antar restart)
  return crypto.createHash("sha256").update(`cek-api::aes::${secret}`).digest();
}

export function encryptSecret(value: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(value: string): string {
  // Migrasi: nilai XOR lama (base64, tanpa prefix) → dekripsi XOR, simpan ulang AES
  if (!value.startsWith(PREFIX)) {
    return legacyDecrypt(value);
  }
  const body = value.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Format enkripsi tidak valid");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/* ── Legacy XOR (hanya untuk migrasi data lama) ────────────── */

function legacyObfuscationKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(
      `cek-api::${process.env.COMPUTERNAME || "local"}::${process.env.USERNAME || "user"}`
    )
    .digest();
}

function legacyDecrypt(value: string): string {
  const key = legacyObfuscationKey();
  const buf = Buffer.from(value, "base64");
  for (let i = 0; i < buf.length; i++) {
    buf[i] = buf[i] ^ key[i % key.length];
  }
  return buf.toString("utf8");
}
