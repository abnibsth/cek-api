/**
 * 🛡️ Proxy — Proteksi Akses (Next.js 16)
 * ---------------------------------------
 * Lapisan pertahanan PERTAMA: memblokir akses ke halaman & API
 * tanpa session valid. (Lapisan kedua: requireAuth di tiap route.)
 *
 * Route yang TIDAK diproteksi (publik):
 *  - /login            → halaman masuk
 *  - /reset            → halaman reset password (via link sekali pakai)
 *  - /api/auth/*       → endpoint login/logout/reset itu sendiri
 *  - /_next/*          → aset Next.js (CSS/JS)
 *  - favicon & file statis lain
 *
 * Semua route lain (/, /api/keys, /api/check, dll) WAJIB punya
 * cookie session valid — kalau tidak, di-redirect ke /login.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/reset",
  "/api/auth/",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Aset statis selalu lolos
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  // Route publik lolos
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return NextResponse.next();
  }

  // Cek session
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    // API route → 401 JSON; halaman → redirect ke /login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Semua route KECUALI static files & images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
