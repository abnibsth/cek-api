/**
 * 🌐 Registry Provider AI
 * -----------------------
 * Daftar semua provider AI yang didukung + cara menghubunginya.
 *
 * Setiap provider berisi:
 *  - baseUrl       : URL dasar API (OpenAI-compatible)
 *  - authHeader    : nama header auth (Authorization / x-api-key / dll)
 *  - authScheme    : "Bearer" (sk-...) atau "none" (kirim key polos)
 *  - balanceType   : "usd" = ada endpoint saldo | "none" = tidak ada
 *  - balanceEndpoint/balancePath: lokasi data saldo di respons API
 *
 * Khusus id "custom" = base URL bebas, untuk API apapun
 * (ini yang jadi DEFAULT di form, supaya semua API bisa masuk).
 *
 * ➕ Mau tambah provider? Cukup tambah 1 entry di array PROVIDERS.
 */
import type { ProviderDefinition } from "./types";

/**
 * Registry of all supported AI providers.
 *
 * Every provider is OpenAI-compatible for the /v1/models endpoint,
 * but balance checking differs:
 *  - Providers with a billing API expose balanceEndpoint + balancePath
 *  - Free-tier / subscription providers have balanceType: "none"
 *
 * To add a new provider, just append an entry here.
 */
export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/docs/api-reference",
    balanceType: "usd",
    balanceEndpoint: "/key",
    balancePath: "data.usage",
    authHeader: "Authorization",
    authScheme: "Bearer",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/docs",
    balanceType: "usd",
    balanceEndpoint: "/dashboard/billing/credit_grants",
    balancePath: "total_granted",
    authHeader: "Authorization",
    authScheme: "Bearer",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    baseUrl: "https://api.anthropic.com/v1",
    docsUrl: "https://docs.anthropic.com",
    balanceType: "none",
    authHeader: "x-api-key",
    authScheme: "none",
    freeTier: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    balanceType: "none",
    authHeader: "x-goog-api-key",
    authScheme: "none",
    keyParam: "key",
    freeTier: true,
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    docsUrl: "https://console.groq.com/docs",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    docsUrl: "https://docs.mistral.ai",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
  },
  {
    id: "cohere",
    name: "Cohere",
    baseUrl: "https://api.cohere.ai/v1",
    docsUrl: "https://docs.cohere.com",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    docsUrl: "https://api-docs.deepseek.com",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    docsUrl: "https://docs.x.ai",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
  },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    docsUrl: "https://docs.together.ai",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    docsUrl: "https://docs.fireworks.ai",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
  },
  {
    id: "puter",
    name: "Puter",
    baseUrl: "https://api.puter.com/puterai/openai/v1",
    docsUrl: "https://puter.com/dashboard",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
    testModel: "gpt-5.4-nano",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    docsUrl: "https://docs.perplexity.ai",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
    freeTier: true,
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseUrl: "",
    docsUrl: "",
    balanceType: "none",
    authHeader: "Authorization",
    authScheme: "Bearer",
  },
];

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
