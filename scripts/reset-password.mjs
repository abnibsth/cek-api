/**
 * 🔄 Script Reset Password (dari terminal) — Supabase Edition
 * ------------------------------------------------------------
 * Cara pakai:
 *   npm run reset-password
 *
 * Fungsi:
 *  1. Generate token sekali pakai (valid 10 menit)
 *  2. Print link reset: {APP_URL}/reset?token=xxx
 *  3. Buka link itu di browser → isi password baru
 *
 * Token disimpan di Supabase table "auth" (row id=1) —
 * langsung bisa dipakai oleh halaman /reset tanpa restart server.
 *
 * Env:
 *  - APP_URL            : URL app (default http://localhost:3000)
 *  - SUPABASE_URL       : https://xxxx.supabase.co
 *  - SUPABASE_SERVICE_KEY : service_role key
 */
import crypto from "node:crypto";

const TTL_MS = 10 * 60 * 1000;
const appUrl = process.env.APP_URL || "http://localhost:3000";
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error("❌ SUPABASE_URL & SUPABASE_SERVICE_KEY belum diatur di .env");
  process.exit(1);
}

const token = crypto.randomBytes(32).toString("hex");
const expiresAt = Date.now() + TTL_MS;

// Update row id=1 di table auth via Supabase REST API
const res = await fetch(`${SB_URL}/rest/v1/auth?id=eq.1`, {
  method: "PATCH",
  headers: {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: JSON.stringify({
    reset_token: token,
    reset_expires: expiresAt,
  }),
});

if (!res.ok) {
  const body = await res.text().catch(() => "");
  console.error(`❌ Gagal simpan token ke Supabase (${res.status}): ${body.slice(0, 200)}`);
  console.error("   Pastikan table 'auth' sudah dibuat dengan row id=1.");
  process.exit(1);
}

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
