/**
 * 🔄 Script Reset Password (dari terminal)
 * ----------------------------------------
 * Cara pakai:
 *   npm run reset-password
 *
 * Fungsi:
 *  1. Generate token sekali pakai (valid 10 menit)
 *  2. Print link reset: {APP_URL}/reset?token=xxx
 *  3. Buka link itu di browser → isi password baru
 *
 * Token disimpan di data/auth.json — langsung bisa dipakai
 * oleh halaman /reset tanpa restart server.
 *
 * Env:
 *  - APP_URL : URL app (default http://localhost:3000)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const AUTH_FILE = path.join(
  process.env.DATA_DIR || path.join(process.cwd(), "data"),
  "auth.json"
);
const TTL_MS = 10 * 60 * 1000;

const appUrl = process.env.APP_URL || "http://localhost:3000";

const token = crypto.randomBytes(32).toString("hex");

fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
const existing = (() => {
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
  } catch {
    return {};
  }
})();

existing.resetToken = { token, expiresAt: Date.now() + TTL_MS };
fs.writeFileSync(AUTH_FILE, JSON.stringify(existing, null, 2), "utf8");

console.log("");
console.log("================================================");
console.log("  🔑 Reset Password — Link Sekali Pakai");
console.log("================================================");
console.log("");
console.log(`  Buka link ini di browser (valid 10 menit):`);
console.log("");
console.log(`  ${appUrl}/reset?token=${token}`);
console.log("");
console.log("  Setelah dipakai, token langsung hangus.");
console.log("  Password baru langsung berlaku — TANPA restart server.");
console.log("");
console.log("  (Kalau link kedaluwarsa, jalankan ulang perintah ini.)");
console.log("================================================");
console.log("");
