/**
 * 🛡️ requireAuth — Proteksi Route Handler
 * ---------------------------------------
 * Dipanggil di AWAL setiap API route yang butuh login.
 * Ini lapisan pertahanan KEDUA (selain proxy) — kalau proxy
 * gagal/terlewat, route tetap menolak request tanpa session.
 *
 * Dipakai bersama cookies() dari next/headers:
 *   const authed = await requireAuth();
 *   if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

export async function requireAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    return verifySessionToken(token);
  } catch {
    return false;
  }
}
