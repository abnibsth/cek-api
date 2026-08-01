/**
 * 🔑 API Route: POST /api/auth/login
 * ----------------------------------
 * Menerima password → verifikasi → set cookie session (httpOnly).
 *
 * Body: { password: string }
 * Sukses : 200 { ok: true }
 * Gagal  : 401 { error: "Password salah" }
 *
 * Rate limit: 5 percobaan / menit per IP (anti brute-force).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  verifyPassword,
  getPasswordHash,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Anti brute-force: maks 5 percobaan per menit per IP
  const rl = rateLimit(request, "login", 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { password } = body as { password?: string };
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password wajib diisi" }, { status: 400 });
    }

    const hash = await getPasswordHash();
    if (!verifyPassword(password, hash)) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
