/**
 * ✅ API Route: /api/check — Cek Semua API Key
 * ---------------------------------------------
 * Endpoint utama untuk mengecek semua key yang tersimpan.
 *
 * GET /api/check           → Cek semua key (pakai cache 5 menit)
 * GET /api/check?refresh=1 → Paksa cek ulang (abaikan cache)
 *
 * Untuk setiap key, app melakukan:
 *  1. GET {baseUrl}/models         → key valid? model apa saja yang tersedia?
 *  2. Cek saldo (jika provider punya endpoint billing)
 *
 * Hasil disimpan di cache supaya tidak spam API provider.
 * Satu key gagal TIDAK mengganggu key lain (Promise.allSettled).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAllRawKeys } from "@/lib/store";
import { checkAllKeys } from "@/lib/checkers";
import { getCached, setCached } from "@/lib/cache";
import type { CheckResult } from "@/lib/types";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/check?refresh=1
 *   Checks all saved keys. Uses cache (5 min TTL) unless refresh=1.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit(request, "check", 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const keys = getAllRawKeys();

  if (keys.length === 0) {
    return NextResponse.json({ results: [], checkedAt: new Date().toISOString() });
  }

  const results: CheckResult[] = [];
  const toCheck = [];
  let freshCount = 0;

  for (const key of keys) {
    const cached = refresh ? null : getCached(key.id);
    if (cached) {
      results.push(cached);
    } else {
      toCheck.push(key);
    }
  }

  if (toCheck.length > 0) {
    const fresh = await checkAllKeys(toCheck);
    freshCount = fresh.length;
    for (let i = 0; i < toCheck.length; i++) {
      setCached(toCheck[i].id, fresh[i]);
    }
    results.push(...fresh);
  }
  return NextResponse.json({
    results,
    checkedAt: new Date().toISOString(),
    fromCache: results.length - freshCount,
  });
}
