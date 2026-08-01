/**
 * 🚪 API Route: POST /api/auth/logout
 * -----------------------------------
 * Hapus cookie session — user logout.
 * Selalu sukses (idempotent), tidak butuh session valid.
 */
import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
