/**
 * 🧪 API Route: /api/test-model — Tes 1 Model Tertentu
 * -----------------------------------------------------
 * Endpoint untuk membuktikan apakah suatu model BISA dipakai
 * di API tertentu (misal: "minimax-cn/minimax-m3" tersedia
 * di web dashboard tapi belum tentu bisa dipanggil via API).
 *
 * POST /api/test-model
 * Body: { keyId: string, model: string }
 *
 * Cara kerja:
 *  - Mengirim chat request kecil ke {baseUrl}/chat/completions
 *  - Prompt: "Say 'pong'" dengan max_tokens: 5 (cepat & murah)
 *  - Jika berhasil 200 → model BISA dipakai ✅
 *  - Jika error (404/400/429 dll) → model TIDAK bisa dipakai ❌
 *    + pesan error dari API (alasan kenapa tidak bisa)
 */
import { NextRequest, NextResponse } from "next/server";
import { getRawKey } from "@/lib/store";
import { testModel } from "@/lib/checkers";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/test-model
 * Body: { keyId: string, model: string }
 * Tests whether a specific model is usable on the key's provider.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit(request, "test-model", 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const body = await request.json();
    const { keyId, model } = body as { keyId?: string; model?: string };

    if (!keyId || !model || typeof model !== "string") {
      return NextResponse.json(
        { error: "keyId and model are required" },
        { status: 400 }
      );
    }

    const entry = await getRawKey(keyId);
    if (!entry) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const result = await testModel(entry, model.trim());
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
