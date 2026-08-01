/**
 * 🧠 Logika Pengecekan (Checkers)
 * -------------------------------
 * "Otak" dari project — berisi semua logika request ke API provider.
 *
 * checkKey(entry)      → Cek 1 key: valid/tidak + saldo + model tersedia
 *   Langkah:
 *    1. GET {baseUrl}/models  → verifikasi key + list model
 *    2. Cek saldo (khusus provider dengan endpoint billing:
 *       OpenRouter → /key, OpenAI → /credit_grants)
 *
 * checkAllKeys(entries) → Cek banyak key PARALEL.
 *   Pakai Promise.allSettled → 1 key gagal TIDAK mengganggu lainnya.
 *
 * testModel(entry, model) → Buktikan model BISA dipakai dengan
 *   mengirim chat kecil "Say 'pong'" (max_tokens: 5) ke
 *   {baseUrl}/chat/completions. 200 = bisa ✅, error = tidak ❌.
 */
import type {
  ApiKeyEntry,
  CheckResult,
  ModelTestResult,
  ProbedModelResult,
  ProviderDefinition,
} from "./types";
import { PROVIDERS, getProvider } from "./providers";

/**
 * Core checking logic.
 *
 * For each key we do two things:
 *  1. GET /models — verifies the key is valid & lists accessible models
 *  2. Balance check (provider-dependent):
 *     - openrouter: GET /key → data.usage (USD spent so far)
 *     - openai:     GET /dashboard/billing/credit_grants → total_granted - total_used
 *     - others:     no billing endpoint → status derived from /models alone
 */

const REQUEST_TIMEOUT_MS = 15000;

/** Resolve the effective base URL (custom providers override the default) */
function resolveBaseUrl(provider: ProviderDefinition, entry: ApiKeyEntry): string {
  if (entry.baseUrl && entry.baseUrl.trim()) {
    return entry.baseUrl.trim().replace(/\/$/, "");
  }
  return provider.baseUrl;
}

/**
 * 🔍 Auto-detect provider dari API key yang TIDAK diketahui base URL-nya.
 * Mencoba key ke SEMUA provider yang dikenal secara paralel,
 * yang merespons "key valid" (HTTP 200) = provider yang benar.
 *
 * Untuk provider tanpa /models (mis. Puter) → fallback tes chat kecil.
 */
export async function detectProvider(
  key: string
): Promise<{ provider: ProviderDefinition; baseUrl: string; modelCount: number } | null> {
  const candidates = PROVIDERS.filter((p) => p.id !== "custom" && p.baseUrl);

  // Coba semua provider paralel, ambil yang pertama berhasil
  const results = await Promise.allSettled(
    candidates.map(async (p) => {
      const baseUrl = p.baseUrl.replace(/\/$/, "");
      let modelsUrl = `${baseUrl}/models`;
      if (p.keyParam) {
        modelsUrl = `${modelsUrl}?key=${encodeURIComponent(key)}`;
      }
      const res = await httpGet(modelsUrl, buildModelsRequest(p, key));
      if (res.ok) {
        const { count } = extractModels(res.json);
        return { provider: p, baseUrl, modelCount: count };
      }
      // /models 404 → coba chat test (Puter & teman-teman)
      if ((res.status === 404 || res.status === 405 || res.status === 501) && p.testModel) {
        const chatOk = await testModel(
          { id: "detect", providerId: p.id, label: "", key, baseUrl: undefined } as ApiKeyEntry,
          p.testModel
        );
        if (chatOk.ok) {
          return { provider: p, baseUrl, modelCount: 0 };
        }
      }
      return null;
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) return r.value;
  }
  return null;
}

/**
 * Model populer yang dicoba saat endpoint /models tidak tersedia.
 * Urutan: paling umum dulu. Termasuk kimi-k3 (model favorit user).
 */
const POPULAR_MODELS = [
  "moonshotai/kimi-k3",
  "gpt-4o-mini",
  "deepseek-chat",
  "gpt-3.5-turbo",
  "gpt-4o",
  "qwen-plus",
  "claude-3-5-sonnet",
  "llama-3.1-8b-instruct",
];

/**
 * 🔬 Auto-probe: coba beberapa model SECARA PARALEL (worker pool)
 * sampai menemukan yang valid. Dipakai saat /models gagal (panel
 * kayak basten). Kembalikan daftar hasil probe + model valid pertama
 * (diurutkan sesuai urutan kandidat — bukan yang pertama selesai).
 */
async function probeModels(
  entry: ApiKeyEntry,
  candidates: string[]
): Promise<{ results: ProbedModelResult[]; firstValid: string | null }> {
  const results: ProbedModelResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const model = candidates[cursor++];
      const r = await quickProbeModel(entry, model);
      results.push(r);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(PROBE_CONCURRENCY, candidates.length) },
      () => worker()
    )
  );

  // Urutkan hasil sesuai urutan kandidat asli (hasil paralel bisa acak)
  results.sort((a, b) => candidates.indexOf(a.model) - candidates.indexOf(b.model));

  const firstValid = results.find((r) => r.ok)?.model ?? null;
  return { results, firstValid };
}

/** Berapa model maksimal yang di-probe saat /models sukses */
const PROBE_MODEL_LIMIT = 10;
/** Berapa probe model yang jalan paralel sekaligus */
const PROBE_CONCURRENCY = 4;

/**
 * ⚡ Quick probe 1 model (versi ringan dari testModel):
 *  - Maks 2 percobaan per path (max_tokens 5 → tanpa max_tokens)
 *  - 404/405/501 = path salah → coba path berikutnya
 *  - 401/403/error model = langsung gagal (hemat waktu)
 */
async function quickProbeModel(
  entry: ApiKeyEntry,
  model: string
): Promise<ProbedModelResult> {
  const provider = getProvider(entry.providerId);
  if (!provider) {
    return { model, ok: false, message: "Unknown provider" };
  }
  const baseUrl = resolveBaseUrl(provider, entry);
  const urlVariants = buildPathVariants(baseUrl, "/chat/completions");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.authScheme === "Bearer") {
    headers[provider.authHeader] = `Bearer ${entry.key}`;
  } else {
    headers[provider.authHeader] = entry.key;
  }

  let lastResult: ModelTestResult | null = null;
  for (const url of urlVariants) {
    for (const maxTokens of [5, null]) {
      const r = await sendChatTest(url, headers, model, maxTokens);
      if (r.ok) {
        return { model, ok: true, latencyMs: r.latencyMs, message: r.message };
      }
      lastResult = r;
      const msg = r.message.toLowerCase();
      const retryable =
        msg.includes("max_tokens") ||
        msg.includes("max tokens") ||
        msg.includes("min") ||
        msg.includes("reasoning") ||
        r.status === 400 ||
        r.status === 422;
      // Path salah (404/405/501) → coba varian path berikutnya
      if (!retryable && (r.status === 404 || r.status === 405 || r.status === 501)) {
        break;
      }
      // Error lain (401 key salah, model nggak ada, dll) → langsung gagal
      if (!retryable) {
        return { model, ok: false, latencyMs: r.latencyMs, message: r.message };
      }
    }
  }
  return {
    model,
    ok: false,
    latencyMs: lastResult?.latencyMs,
    message: lastResult?.message ?? "Gagal tes model",
  };
}

/**
 * 🔬 Probe daftar model dengan concurrency terbatas.
 * Kembalikan hasil + daftar model aktif & gagal (urut).
 */
async function probeModelList(
  entry: ApiKeyEntry,
  models: string[]
): Promise<{ results: ProbedModelResult[]; active: string[]; inactive: string[] }> {
  const results: ProbedModelResult[] = [];
  const active: string[] = [];
  const inactive: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < models.length) {
      const model = models[cursor++];
      const r = await quickProbeModel(entry, model);
      results.push(r);
      if (r.ok) active.push(model);
      else inactive.push(model);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, models.length) }, () => worker())
  );
  return { results, active, inactive };
}

interface HttpResult {
  ok: boolean;
  status: number;
  json: unknown;
  latencyMs: number;
}

async function httpGet(
  url: string,
  headers: Record<string, string>
): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      json,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      json: null,
      latencyMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function extractErrorMessage(json: unknown, status: number): string {
  if (!json || typeof json !== "object") {
    return status ? `HTTP ${status}` : "Network error";
  }
  const obj = json as Record<string, unknown>;
  // OpenAI/OpenRouter style: { error: { message } }
  const err = obj.error as Record<string, unknown> | undefined;
  if (err && typeof err.message === "string") return err.message;
  if (typeof obj.message === "string") return obj.message;
  // Gemini style: { error: { message } } (same shape)
  if (typeof obj.error === "string") return obj.error;
  return status ? `HTTP ${status}` : "Unknown error";
}

/** Headers for the models request */
function buildModelsRequest(provider: ProviderDefinition, key: string) {
  const headers: Record<string, string> = {};
  if (provider.authScheme === "Bearer") {
    headers[provider.authHeader] = `Bearer ${key}`;
  } else if (provider.keyParam) {
    // Gemini uses ?key= in the URL — handled by the caller
    headers[provider.authHeader] = key;
  } else {
    headers[provider.authHeader] = key;
  }
  return headers;
}

function extractModels(json: unknown): { count: number; ids: string[] } {
  if (!json || typeof json !== "object") return { count: 0, ids: [] };
  const obj = json as Record<string, unknown>;
  const data = obj.data;
  if (Array.isArray(data)) {
    const ids = data
      .map((m) => (m as Record<string, unknown>).id)
      .filter((id): id is string => typeof id === "string");
    return { count: ids.length, ids };
  }
  // Gemini returns { models: [...] } with "name" fields
  const models = obj.models;
  if (Array.isArray(models)) {
    const ids = models
      .map((m) => (m as Record<string, unknown>).name)
      .filter((id): id is string => typeof id === "string");
    return { count: ids.length, ids };
  }
  return { count: 0, ids: [] };
}

async function checkModels(
  provider: ProviderDefinition,
  key: string,
  baseUrl: string
): Promise<{ models: { count: number; ids: string[] }; error?: string; status: number }> {
  // Coba beberapa varian path (panel gateway seperti 9router kadang butuh /v1)
  const variants = buildPathVariants(baseUrl, "/models");
  for (const url of variants) {
    const fullUrl = provider.keyParam
      ? `${url}?key=${encodeURIComponent(key)}`
      : url;
    const res = await httpGet(fullUrl, buildModelsRequest(provider, key));
    if (res.ok) {
      return { models: extractModels(res.json), status: res.status };
    }
    // 401/403 = key salah — jangan coba varian lain
    if (res.status === 401 || res.status === 403) {
      return {
        models: { count: 0, ids: [] },
        error: extractErrorMessage(res.json, res.status),
        status: res.status,
      };
    }
    // 404/405 → coba varian berikutnya
    if (res.status === 404 || res.status === 405 || res.status === 501) {
      continue;
    }
    return {
      models: { count: 0, ids: [] },
      error: extractErrorMessage(res.json, res.status),
      status: res.status,
    };
  }
  return {
    models: { count: 0, ids: [] },
    error: "Endpoint /models tidak ditemukan (404)",
    status: 404,
  };
}

/** Buat variasi path: /models, /v1/models */
function buildPathVariants(baseUrl: string, path: string): string[] {
  const cleaned = baseUrl.replace(/\/$/, "");
  const variants = [`${cleaned}${path}`];
  if (!cleaned.endsWith("/v1")) {
    variants.push(`${cleaned}/v1${path}`);
  }
  return variants;
}

async function checkBalance(
  provider: ProviderDefinition,
  key: string,
  baseUrl: string
): Promise<{ balance: number | null; limit: number | null; error?: string }> {
  if (!provider.balanceEndpoint || !provider.balancePath) {
    return { balance: null, limit: null };
  }
  let url = `${baseUrl}${provider.balanceEndpoint}`;
  if (provider.keyParam) {
    url = `${url}?key=${encodeURIComponent(key)}`;
  }
  const headers: Record<string, string> = {};
  if (provider.authScheme === "Bearer") {
    headers[provider.authHeader] = `Bearer ${key}`;
  } else {
    headers[provider.authHeader] = key;
  }
  const res = await httpGet(url, headers);
  if (!res.ok) {
    return { balance: null, limit: null, error: extractErrorMessage(res.json, res.status) };
  }
  const raw = deepGet(res.json, provider.balancePath);
  const balance = typeof raw === "number" ? raw : null;

  // OpenRouter: data.limit is the credit limit
  const limitRaw = deepGet(res.json, "data.limit");
  const limit = typeof limitRaw === "number" ? limitRaw : null;

  return { balance, limit };
}

/** Run a full check for one API key */
export async function checkKey(entry: ApiKeyEntry): Promise<CheckResult> {
  const provider = getProvider(entry.providerId);
  const baseUrl = resolveBaseUrl(provider!, entry);
  const base: CheckResult = {
    keyId: entry.id,
    providerId: entry.providerId,
    label: entry.label,
    status: "checking",
    balance: null,
    balanceDisplay: null,
    limit: null,
    modelCount: 0,
    modelSamples: [],
    rateLimit: null,
    message: "Checking…",
    checkedAt: new Date().toISOString(),
    latencyMs: 0,
  };

  if (!provider) {
    return { ...base, status: "error", message: `Unknown provider: ${entry.providerId}` };
  }

  // Guard: base URL kosong (custom tanpa baseUrl) → langsung error jelas
  if (!baseUrl) {
    return {
      ...base,
      status: "error",
      message: "Base URL kosong — isi base URL atau pakai 🔍 Deteksi untuk cari provider otomatis",
    };
  }

  // 1) Verify key via /models
  const modelsRes = await checkModels(provider, entry.key, baseUrl);

  if (modelsRes.error) {
    // Endpoint /models tidak tersedia (404/405/501) → coba validasi via chat kecil
    const noModelsEndpoint =
      modelsRes.status === 404 || modelsRes.status === 405 || modelsRes.status === 501;

    // Kalau provider punya testModel default ATAU custom → coba chat test
    const canChatTest = provider.testModel || entry.providerId === "custom";
    if (noModelsEndpoint && canChatTest) {
      // 🔬 Auto-probe model populer → ketauan model mana yang valid
      const probeCandidates = provider.testModel
        ? [provider.testModel]
        : POPULAR_MODELS;
      const probe = await probeModels(entry, probeCandidates);
      base.probedModels = probe.results;

      if (probe.firstValid) {
        base.modelCount = 0;
        base.modelSamples = [probe.firstValid];
        base.modelIds = [probe.firstValid];
        base.status = "ok";
        base.message = `Key valid — model ${probe.firstValid} bisa dipakai (endpoint /models tidak tersedia)`;
        const bal = await checkBalance(provider, entry.key, baseUrl);
        if (bal.balance !== null) {
          base.balance = bal.balance;
          base.balanceDisplay = `$${bal.balance.toFixed(2)}`;
        }
        return base;
      }

      // Nggak ada model yang valid — kasih tau detail hasil probe
      const lastError = probe.results[probe.results.length - 1]?.message ?? "Tidak ada model yang bisa dipakai";
      return {
        ...base,
        status: "invalid",
        message: `Key tidak valid — ${lastError}`,
      };
    }

    const isInvalid =
      modelsRes.status === 401 || modelsRes.status === 403 || modelsRes.status === 400;
    return {
      ...base,
      status: isInvalid ? "invalid" : "error",
      message: modelsRes.error,
    };
  }

  base.modelCount = modelsRes.models.count;
  base.modelIds = modelsRes.models.ids;
  base.modelSamples = modelsRes.models.ids.slice(0, 8);

  // 🔬 Probe model dari /models → yang AKTIF tampil duluan
  if (base.modelIds.length > 0) {
    const probeList = base.modelIds.slice(0, PROBE_MODEL_LIMIT);
    const probe = await probeModelList(entry, probeList);
    base.probedModels = probe.results;
    if (probe.active.length > 0) {
      // Aktif duluan, sisanya di belakang
      base.modelSamples = [...probe.active, ...probe.inactive];
      base.modelCount = probe.active.length;
    }
  } else if (base.modelCount === 0) {
    // /models sukses tapi nggak ngembaliin model (format beda / list kosong)
    // → 🔬 auto-probe buat nemuin model yang beneran valid
    const probeCandidates = provider.testModel
      ? [provider.testModel]
      : POPULAR_MODELS;
    const probe = await probeModels(entry, probeCandidates);
    base.probedModels = probe.results;
    if (probe.firstValid) {
      base.modelSamples = [probe.firstValid];
      base.modelIds = [probe.firstValid];
      base.modelCount = probe.results.filter((r) => r.ok).length;
    }
  }

  // 2) Balance check (if supported)
  const bal = await checkBalance(provider, entry.key, baseUrl);
  if (bal.balance !== null) {
    base.balance = bal.balance;
    base.balanceDisplay = `$${bal.balance.toFixed(2)}`;
  }
  if (bal.limit !== null) {
    base.limit = bal.limit;
  }

  if (provider.balanceType === "usd" && base.balance === null) {
    base.status = "ok";
    base.message =
      base.modelSamples.length > 0
        ? `Key valid — model ${base.modelSamples[0]} bisa dipakai`
        : `Key valid — ${base.modelCount} models. Balance check unavailable.`;
  } else if (provider.balanceType === "usd") {
    base.status = "ok";
    base.message =
      base.modelSamples.length > 0
        ? `Key valid — model ${base.modelSamples[0]} bisa dipakai • saldo $${base.balance!.toFixed(2)}`
        : `Key valid — balance $${base.balance!.toFixed(2)} • ${base.modelCount} models`;
  } else {
    base.status = "ok";
    base.message =
      base.modelSamples.length > 0
        ? `Key valid — model ${base.modelSamples[0]} bisa dipakai`
        : `Key valid — ${base.modelCount} models available`;
  }

  return base;
}

/** Check many keys in parallel; one failure never breaks the others */
export async function checkAllKeys(
  entries: ApiKeyEntry[]
): Promise<CheckResult[]> {
  const results = await Promise.allSettled(entries.map((e) => checkKey(e)));
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      keyId: entries[i].id,
      providerId: entries[i].providerId,
      label: entries[i].label,
      status: "error" as const,
      balance: null,
      balanceDisplay: null,
      limit: null,
      modelCount: 0,
      modelSamples: [],
      modelIds: [],
      rateLimit: null,
      message: "Unexpected error during check",
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
    };
  });
}

/**
 * Test whether a specific model is usable by sending a tiny chat request.
 * Uses a minimal prompt so it's fast and cheap.
 *
 * Robustness:
 *  - Beberapa model (mis. Kimi K3/Moonshot) menolak max_tokens terlalu kecil
 *    → retry otomatis dengan max_tokens 64 kalau gagal
 *  - Handle response format baru (content bisa berupa array of parts)
 */
export async function testModel(
  entry: ApiKeyEntry,
  model: string
): Promise<ModelTestResult> {
  const provider = getProvider(entry.providerId);

  if (!provider) {
    return {
      model,
      ok: false,
      message: `Unknown provider: ${entry.providerId}`,
    };
  }

  const baseUrl = resolveBaseUrl(provider, entry);

  // Coba beberapa varian path (panel gateway kadang butuh /v1)
  const urlVariants = buildPathVariants(baseUrl, "/chat/completions");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (provider.authScheme === "Bearer") {
    headers[provider.authHeader] = `Bearer ${entry.key}`;
  } else {
    headers[provider.authHeader] = entry.key;
  }

  // Coba dengan max_tokens kecil dulu; kalau ditolak, retry lebih besar,
  // dan terakhir coba TANPA field max_tokens (model reasoning seperti
  // Kimi K3 kadang menolak parameter ini sama sekali)
  for (const url of urlVariants) {
    for (const maxTokens of [5, 64, 256, null]) {
      const result = await sendChatTest(url, headers, model, maxTokens);
      if (result.ok) return result;
      // Kalau error bukan karena max_tokens/path, langsung stop
      const msg = result.message.toLowerCase();
      const maxTokensIssue =
        msg.includes("max_tokens") ||
        msg.includes("max tokens") ||
        msg.includes("maximum context") ||
        msg.includes("too small") ||
        msg.includes("min") ||
        msg.includes("reasoning") ||
        result.status === 400 ||
        result.status === 422;
      if (!maxTokensIssue) return result;
    }
    // Path ini gagal semua → coba path berikutnya
  }

  // Semua percobaan gagal — kembalikan hasil terakhir
  return sendChatTest(urlVariants[0], headers, model, 64);
}

/** Kirim 1 chat test & parse hasilnya */
async function sendChatTest(
  url: string,
  headers: Record<string, string>,
  model: string,
  maxTokens: number | null
): Promise<ModelTestResult> {
  const payload: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: "Say 'pong'" }],
  };
  // max_tokens null = jangan kirim field sama sekali
  // (beberapa model reasoning menolak parameter ini)
  if (maxTokens !== null) {
    payload.max_tokens = maxTokens;
  }
  const body = JSON.stringify(payload);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - start;
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      return {
        model,
        ok: false,
        status: res.status,
        latencyMs,
        message: extractErrorMessage(json, res.status),
      };
    }

    const obj = json as Record<string, unknown> | null;
    const choices = obj?.choices as Array<Record<string, unknown>> | undefined;
    const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
    const content = msg?.content;
    // content bisa string ("pong") atau array of parts [{type:"text", text:"pong"}]
    let text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      text = content
        .map((c) => {
          const part = c as Record<string, unknown>;
          return typeof part.text === "string" ? part.text : "";
        })
        .join("");
    }
    const sample = text.slice(0, 80) || undefined;

    return {
      model,
      ok: true,
      status: res.status,
      latencyMs,
      message: "Model bisa dipakai ✅",
      sample,
    };
  } catch (err) {
    return {
      model,
      ok: false,
      latencyMs: Date.now() - start,
      message: err instanceof Error && err.name === "AbortError"
        ? "Timeout — model terlalu lama merespons"
        : "Gagal terhubung ke API",
    };
  } finally {
    clearTimeout(timer);
  }
}
