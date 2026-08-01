/**
 * 🔐 Autentikasi (Auth) — Supabase Edition
 * ------------------------------------------
 * Sebelumnya: password hash & reset token di data/auth.json (fs)
 * Sekarang:   di Supabase table "auth" (single row, id=1)
 *
 * Yang TIDAK berubah:
 *  - Password utama dari env var AUTH_PASSWORD
 *  - Hash password: scrypt (sinkron, tetap)
 *  - Session token: HMAC-SHA256 (sinkron, tetap)
 *  - Cookie httpOnly + sameSite=lax + secure (HTTPS)
 *
 * Yang berubah jadi async:
 *  - getPasswordHash() → baca dari Supabase
 *  - setPasswordHash() → tulis ke Supabase
 *  - createResetToken() → tulis ke Supabase
 *  - verifyResetToken() → baca dari Supabase
 *  - consumeResetToken() → update Supabase
 *
 * Env vars:
 *  - AUTH_PASSWORD : password login awal (WAJIB)
 *  - AUTH_SECRET   : kunci rahasia session (WAJIB, random)
 *  - SUPABASE_URL  : URL project Supabase
 *  - SUPABASE_SERVICE_KEY : service_role key
 */
import crypto from "node:crypto";
import { dbGetAuth, dbUpsertAuth } from "./db";

const SESSION_COOKIE = "cekapi_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

/** Waktu validasi token reset password (10 menit) */
export const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

/* ── Env config ────────────────────────────────────────────── */

function getPassword(): string {
  const pw = process.env.AUTH_PASSWORD;
  if (!pw || pw.length < 4) {
    throw new Error(
      "AUTH_PASSWORD belum diatur. Set di .env (minimal 4 karakter), lalu restart server."
    );
  }
  return pw;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET belum diatur. Set di .env (minimal 16 karakter random), lalu restart server."
    );
  }
  return secret;
}

/* ── Hashing password (scrypt) — tetap sinkron ─────────────── */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

/* ── Password hash storage (Supabase) — async ──────────────── */

let cachedHash: string | null = null;

export async function getPasswordHash(): Promise<string> {
  if (cachedHash) return cachedHash;
  const row = await dbGetAuth();
  if (row.password_hash) {
    cachedHash = row.password_hash;
    return cachedHash;
  }
  // Belum ada hash di DB → derive dari AUTH_PASSWORD, simpan
  cachedHash = hashPassword(getPassword());
  await dbUpsertAuth({ id: 1, password_hash: cachedHash });
  return cachedHash;
}

/** Simpan hash baru (dipanggil saat reset password) */
export async function setPasswordHash(hash: string): Promise<void> {
  cachedHash = hash;
  await dbUpsertAuth({
    password_hash: hash,
    reset_token: null,
    reset_expires: null,
  });
}

/* ── Token reset sekali pakai (Supabase) — async ────────────── */

export async function createResetToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await dbUpsertAuth({
    reset_token: token,
    reset_expires: Date.now() + RESET_TOKEN_TTL_MS,
  });
  return token;
}

export async function verifyResetToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const row = await dbGetAuth();
  if (!row.reset_token || !row.reset_expires) return false;
  try {
    return (
      crypto.timingSafeEqual(
        Buffer.from(row.reset_token),
        Buffer.from(token)
      ) && row.reset_expires > Date.now()
    );
  } catch {
    return false;
  }
}

/** Hapus token setelah berhasil dipakai */
export async function consumeResetToken(): Promise<void> {
  await dbUpsertAuth({ reset_token: null, reset_expires: null });
}

/* ── Session token (HMAC) — tetap sinkron ──────────────────── */

export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const expected = crypto
      .createHmac("sha256", getSecret())
      .update(payload)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    // AUTH_SECRET belum di-set / token rusak → dianggap belum login
    return false;
  }
}

export function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export { SESSION_COOKIE };
