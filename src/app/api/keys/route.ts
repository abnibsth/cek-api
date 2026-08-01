/**
 * 🔑 API Route: /api/keys — Kelola API Key
 * -----------------------------------------
 * Endpoint backend untuk menyimpan & membaca API key.
 *
 * GET    /api/keys           → List semua key (versi MASKED, aman)
 *                              + hasil cache terakhir per key
 * POST   /api/keys           → Simpan key baru
 *                              Body: { providerId, label, key, baseUrl? }
 * DELETE /api/keys?id=xxx    → Hapus key berdasarkan id
 *
 * Catatan: key ASLI tidak pernah dikirim ke browser —
 * hanya versi mask (sk-abc••••••••xyz) yang dikirim.
 */
import { NextRequest, NextResponse } from "next/server";
import { listKeys, getRawKey, addKey } from "@/lib/store";
import { getCached } from "@/lib/cache";
import { getProvider } from "@/lib/providers";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/keys — list all saved keys (masked) with cached results.
 * POST /api/keys — add a new API key.
 * DELETE /api/keys?id=xxx — remove a key.
 */

async function guard(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimit(request, "api", 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;
  const keys = await listKeys();
  const items = await Promise.all(
    keys.map(async (k) => {
      const raw = await getRawKey(k.id);
      const provider = raw ? getProvider(raw.providerId) : undefined;
      const cached = raw ? getCached(raw.id) : null;
      return {
        ...k,
        providerName: provider?.name ?? k.providerId,
        baseUrl: raw?.baseUrl?.trim() || provider?.baseUrl || "",
        cachedResult: cached,
      };
    })
  );
  return NextResponse.json({ keys: items });
}

export async function POST(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { providerId, label, key, baseUrl } = body as {
      providerId?: string;
      label?: string;
      key?: string;
      baseUrl?: string;
    };

    if (!providerId || !key || typeof key !== "string") {
      return NextResponse.json(
        { error: "providerId and key are required" },
        { status: 400 }
      );
    }
    if (!getProvider(providerId)) {
      return NextResponse.json(
        { error: `Unknown provider: ${providerId}` },
        { status: 400 }
      );
    }
    if (key.trim().length < 8) {
      return NextResponse.json(
        { error: "API key looks too short to be valid" },
        { status: 400 }
      );
    }

    const entry = await addKey({ providerId, label, key, baseUrl });
    return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }
  const { deleteKey } = await import("@/lib/store");
  const ok = await deleteKey(id);
  return NextResponse.json({ ok });
}
