// Shared type definitions for the cek-api project

/**
 * 📦 Tipe Data (TypeScript)
 * -------------------------
 * Semua definisi tipe yang dipakai bersama di seluruh project.
 * File ini TIDAK berisi logika — hanya "kontrak" bentuk data.
 *
 * Tipe utama:
 *  - ProviderId        : ID provider (openrouter, openai, custom, dll)
 *  - ProviderDefinition: Definisi 1 provider (base URL, auth, endpoint saldo)
 *  - ApiKeyEntry       : Data 1 API key yang tersimpan di disk
 *  - CheckResult       : Hasil cek 1 key (status, saldo, model, pesan)
 *  - ModelTestResult   : Hasil tes 1 model (bisa dipakai atau tidak)
 *  - CacheEntry/File   : Bentuk file cache di disk
 */
export type ProviderId =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "mistral"
  | "cohere"
  | "deepseek"
  | "xai"
  | "together"
  | "fireworks"
  | "puter"
  | "perplexity"
  | "custom";

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  /** Base URL for OpenAI-compatible endpoints */
  baseUrl: string;
  /** Docs URL shown in the UI */
  docsUrl: string;
  /** How this provider reports balance. */
  balanceType: "usd" | "none";
  /** Optional: endpoint to check balance */
  balanceEndpoint?: string;
  /** How the balance is extracted from the response */
  balancePath?: string;
  /** Key header name to send */
  authHeader: string;
  /** Auth scheme, e.g. "Bearer" or "none" */
  authScheme?: string;
  /** Whether the provider is a free-tier / subscription (no billing endpoint) */
  freeTier?: boolean;
  /** Extra config for providers with unique auth (e.g. Gemini query param) */
  keyParam?: string;
  /** Default model name dipakai untuk tes validitas ketika /models tidak tersedia */
  testModel?: string;
}

export interface ApiKeyEntry {
  id: string;
  providerId: ProviderId;
  /** Label/note the user gives, e.g. "OpenRouter utama" */
  label: string;
  key: string;
  /** Optional custom base URL for the "custom" provider */
  baseUrl?: string;
  createdAt: string;
}

export type CheckStatus = "ok" | "invalid" | "error" | "checking" | "pending";

export interface CheckResult {
  /** The id of the ApiKeyEntry this result belongs to */
  keyId: string;
  providerId: ProviderId;
  label: string;
  status: CheckStatus;
  /** For balance-able providers: remaining balance in USD */
  balance?: number | null;
  /** Raw balance string for display, e.g. "$12.50" */
  balanceDisplay?: string | null;
  /** Limit (for OpenRouter-style keys) */
  limit?: number | null;
  /** Number of models accessible */
  modelCount?: number;
  /** Sample of model IDs (first few) */
  modelSamples?: string[];
  /** FULL list of model IDs — dipakai untuk fitur "lihat semua" */
  modelIds?: string[];
  /**
   * Hasil auto-probe: daftar model yang dicoba saat endpoint /models
   * tidak tersedia. Berisi model + status valid/gagal.
   */
  probedModels?: ProbedModelResult[];
  /** For free-tier providers: rate limit info if available */
  rateLimit?: {
    requestsPerMinute?: number | null;
    tokensPerMinute?: number | null;
    tokensPerDay?: number | null;
  } | null;
  /** Human-readable message */
  message: string;
  /** When the check ran */
  checkedAt: string;
  /** Latency in ms */
  latencyMs?: number;
}

export interface ApiKeysFile {
  keys: ApiKeyEntry[];
}

export interface CacheEntry {
  keyId: string;
  providerId: ProviderId;
  label: string;
  result: CheckResult;
  cachedAt: string;
}

export interface CacheFile {
  /** Versi skema cache — beda versi = cache lama tidak valid */
  version?: number;
  entries: CacheEntry[];
}

/** Hasil auto-probe satu model saat /models tidak tersedia */
export interface ProbedModelResult {
  model: string;
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

/** Result of testing whether a specific model is usable */
export interface ModelTestResult {
  model: string;
  ok: boolean;
  status?: number;
  message: string;
  latencyMs?: number;
  /** First few tokens of the reply, to prove it works */
  sample?: string;
}

export interface ModelTestRequest {
  providerId: string;
  model: string;
}

