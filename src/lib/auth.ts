/**
 * 🔐 Autentikasi (Auth)
 * ---------------------
 * Sistem login password tunggal — cocok untuk tool personal
 * yang diakses dari mana saja (deploy ke VPS).
 *
 * Desain:
 *  - Password utama dari env var AUTH_PASSWORD
 *  - Reset password → token sekali pakai (10 menit) → hash baru
 *    disimpan di data/auth.json (override env var)
 *  - Password disimpan sebagai HASH (scrypt) — bukan plaintext
 *  - Session = token HMAC-SHA256 berisi payload + signature
 *    (tidak bisa dipalsukan tanpa AUTH_SECRET)
 *  - Cookie httpOnly + sameSite=lax + secure (jika HTTPS)
 *
 * Env vars:
 *  - AUTH_PASSWORD : password login awal (WAJIB diisi sebelum deploy)
 *  - AUTH_SECRET   : kunci rahasia session (WAJIB diisi, random)
 *
 * Reset password (jika lupa):
 *  npm run reset-password → print link sekali pakai
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SESSION_COOKIE = "cekapi_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

/** Waktu validasi token reset password (10 menit) */
export const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

const AUTH_FILE = path.join(
  process.env.DATA_DIR || path.join(process.cwd(), "data"),
  "auth.json"
);

interface AuthFile {
  passwordHash?: string;
  resetToken?: { token: string; expiresAt: number };
}

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

/* ── File penyimpanan hash (data/auth.json) ───────────────── */

function readAuthFile(): AuthFile {
  try {
    if (!fs.existsSync(AUTH_FILE)) return {};
    return JSON.parse(fs.readFileSync(AUTH_FILE, "utf8")) as AuthFile;
  } catch {
    return {};
  }
}

function writeAuthFile(data: AuthFile) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), "utf8");
}

/* ── Hashing password (scrypt) ─────────────────────────────── */

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

/**
 * Hash password aktif: pakai hash dari data/auth.json (jika ada hasil reset),
 * selain itu derive stabil dari AUTH_PASSWORD. Di-cache di memory.
 */
let cachedHash: string | null = null;

export function getPasswordHash(): string {
  if (cachedHash) return cachedHash;
  const file = readAuthFile();
  if (file.passwordHash) {
    cachedHash = file.passwordHash;
    return cachedHash;
  }
  cachedHash = hashPassword(getPassword());
  return cachedHash;
}

/** Simpan hash baru (dipanggil saat reset password) */
export function setPasswordHash(hash: string) {
  cachedHash = hash;
  const file = readAuthFile();
  file.passwordHash = hash;
  file.resetToken = undefined;
  writeAuthFile(file);
}

/* ── Token reset sekali pakai ──────────────────────────────── */

export function createResetToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  const file = readAuthFile();
  file.resetToken = { token, expiresAt: Date.now() + RESET_TOKEN_TTL_MS };
  writeAuthFile(file);
  return token;
}

export function verifyResetToken(token: string | undefined): boolean {
  if (!token) return false;
  const file = readAuthFile();
  if (!file.resetToken) return false;
  return (
    crypto.timingSafeEqual(
      Buffer.from(file.resetToken.token),
      Buffer.from(token)
    ) && file.resetToken.expiresAt > Date.now()
  );
}

/** Hapus token setelah berhasil dipakai */
export function consumeResetToken() {
  const file = readAuthFile();
  file.resetToken = undefined;
  writeAuthFile(file);
}

/* ── Session token (HMAC) ──────────────────────────────────── */

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
