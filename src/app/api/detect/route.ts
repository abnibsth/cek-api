/**
 * 🔍 API Route: /api/detect — Auto-Detect Provider dari API Key
 * ---------------------------------------------------------------
 * Endpoint untuk menebak provider & base URL dari key yang TIDAK diketahui.
 *
 * POST /api/detect
 * Body: { key: string }
 *
 * Cara kerja:
 *  - Mencoba key ke SEMUA provider yang dikenal secara paralel
 *  - Provider yang merespons "key valid" (HTTP 200 / chat OK) = ketemu
 *  - Mengembalikan: { providerId, providerName, baseUrl, modelCount }
 *
 * Cocok untuk key tanpa prefix khas (mis. "I1sMj6UH.yYUE...")
 * yang biasanya dari panel API gateway (9Router / New API / one-api).
 */
import { NextRequest, NextResponse } from "next/server";
import { detectProvider } from "@/lib/checkers";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit(request, "detect", 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const body = await request.json();
    const { key } = body as { key?: string };

    if (!key || typeof key !== "string" || !key.trim()) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const result = await detectProvider(key.trim());

    if (!result) {
      return NextResponse.json({
        detected: false,
        message:
          "Key tidak cocok dengan provider yang dikenal. Coba isi base URL manual (Custom).",
      });
    }

    return NextResponse.json({
      detected: true,
      providerId: result.provider.id,
      providerName: result.provider.name,
      baseUrl: result.baseUrl,
      modelCount: result.modelCount,
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
