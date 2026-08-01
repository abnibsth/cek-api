/**
 * 🔄 API Route: POST /api/auth/reset
 * ----------------------------------
 * Reset password via token sekali pakai (dari terminal).
 *
 * Body: { token: string, password: string }
 *  - Token valid (10 menit) + password baru (min 4 karakter)
 *  - Simpan hash baru ke data/auth.json → langsung berlaku
 *  - Token langsung dikonsumsi (sekali pakai)
 *
 * Rate limit: 3 percobaan / menit per IP.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  verifyResetToken,
  consumeResetToken,
  setPasswordHash,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, "reset", 3, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { token, password } = body as { token?: string; password?: string };

    if (!token || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Token dan password baru wajib diisi" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: "Password minimal 4 karakter" }, { status: 400 });
    }
    if (!verifyResetToken(token)) {
      return NextResponse.json(
        { error: "Token tidak valid atau sudah kedaluwarsa. Jalankan ulang npm run reset-password." },
        { status: 401 }
      );
    }

    setPasswordHash(hashPassword(password));
    consumeResetToken();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
