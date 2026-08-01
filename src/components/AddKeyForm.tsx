/**
 * ➕ Form Tambah API Key
 * ----------------------
 * Form untuk menyimpan API key baru ke penyimpanan lokal.
 *
 * Fungsi:
 *  - Input API key + base URL (default provider: "Custom / Auto-detect")
 *  - AUTO-DETECT dari prefix key:
 *      pt-...    → Puter
 *      sk-or-... → OpenRouter
 *      sk-ant-...→ Anthropic
 *      gsk_...   → Groq
 *      pplx-...  → Perplexity
 *      AIza...   → Gemini
 *    (jadi tinggal paste key, nggak perlu tau base URL)
 *  - Auto-detect juga dari base URL jika paste URL yang dikenal
 *  - Validasi: key wajib; base URL wajib HANYA untuk custom
 *  - Kirim ke POST /api/keys → key tersimpan di data/keys.json (ter-obfuscate)
 *
 * Props:
 *  - onAdded: callback yang dipanggil setelah key berhasil disimpan
 *             (dipakai dashboard untuk langsung menjalankan pengecekan)
 */
"use client";

import { useState } from "react";
import { PROVIDERS } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";

export default function AddKeyForm({ onAdded }: { onAdded: () => void }) {
  // Default to "custom" so any API can be added
  const [providerId, setProviderId] = useState<ProviderId>("custom");
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectInfo, setDetectInfo] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const isCustom = providerId === "custom";
  const provider = PROVIDERS.find((p) => p.id === providerId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!key.trim()) {
      setError("API key wajib diisi");
      return;
    }
    setSaving(true);
    try {
      // 🔍 Auto-detect: kalau custom & base URL kosong, coba cari provider aslinya
      let finalProviderId = providerId;
      let finalBaseUrl = baseUrl;
      if (isCustom && !baseUrl.trim()) {
        try {
          const res = await fetch("/api/detect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key.trim() }),
          });
          const data = await res.json();
          if (data.detected) {
            finalProviderId = data.providerId as ProviderId;
            finalBaseUrl = data.baseUrl ?? "";
          }
        } catch {
          // detect gagal — lanjut simpan custom polos
        }
      }
      if (finalProviderId === "custom" && !finalBaseUrl.trim()) {
        setError("Base URL wajib diisi untuk API custom");
        return;
      }
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: finalProviderId,
          label,
          key,
          ...(finalProviderId === "custom" && finalBaseUrl.trim() ? { baseUrl: finalBaseUrl } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan key");
        return;
      }
      setKey("");
      setLabel("");
      setBaseUrl("");
      setProviderId("custom");
      onAdded();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  }

  /** Auto-detect provider when the user pastes a known base URL */
  function handleBaseUrlChange(value: string) {
    setBaseUrl(value);
    const url = value.trim().toLowerCase();
    for (const p of PROVIDERS) {
      if (p.id === "custom") continue;
      if (url.includes(new URL(p.baseUrl).hostname)) {
        setProviderId(p.id as ProviderId);
        return;
      }
    }
  }

  /** Auto-detect provider from the API key prefix (e.g. pt- → Puter) */
  function handleKeyChange(value: string) {
    setKey(value);
    setDetectInfo(null);
    const k = value.trim().toLowerCase();
    if (k.startsWith("pt-")) setProviderId("puter");
    else if (k.startsWith("sk-or-")) setProviderId("openrouter");
    else if (k.startsWith("sk-ant-")) setProviderId("anthropic");
    else if (k.startsWith("gsk_")) setProviderId("groq");
    else if (k.startsWith("pplx-")) setProviderId("perplexity");
    else if (k.startsWith("AIza")) setProviderId("gemini");
  }

  /** 🔍 Coba deteksi provider dari key yang tidak diketahui */
  async function handleDetect() {
    if (!key.trim()) {
      setError("Isi API key dulu");
      return;
    }
    setError(null);
    setDetectInfo(null);
    setDetecting(true);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json();
      if (data.detected) {
        setProviderId(data.providerId as ProviderId);
        setBaseUrl(data.baseUrl);
        setDetectInfo(
          `✅ Terdeteksi: ${data.providerName} (${data.modelCount} model) — base URL terisi otomatis`
        );
      } else {
        setDetectInfo(
          "❌ Tidak terdeteksi. Key tidak cocok dengan provider yang dikenal — isi base URL manual."
        );
      }
    } catch {
      setDetectInfo("❌ Gagal terhubung ke server");
    } finally {
      setDetecting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-[var(--surface)] p-5 sm:p-6"
    >
      <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.3px] text-[var(--text-mute)]">
        Tambah API Key
      </h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--text-mute)]">Provider (opsional — auto-detect)</span>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value as ProviderId)}
            className="h-12 w-full rounded border border-[var(--border-input)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-strong)] outline-none transition-colors focus:border-[var(--primary)]"
          >
            <option value="custom">Custom / Auto-detect</option>
            {PROVIDERS.filter((p) => p.id !== "custom").map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--text-mute)]">Label (opsional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='mis. "API vibe"'
            className="h-12 w-full rounded border border-[var(--border-input)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-strong)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--primary)]"
          />
        </label>
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs text-[var(--text-mute)]">Base URL (OpenAI-compatible)</span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            placeholder="https://vibe.madewgn.dev/v1"
            className="h-12 w-full rounded border border-[var(--border-input)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-strong)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--primary)]"
          />
        </label>
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs text-[var(--text-mute)]">API Key</span>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="sk-... / pt-... / I1sMj6UH.yYUE..."
              className="h-12 min-w-0 flex-1 rounded border border-[var(--border-input)] bg-[var(--input-bg)] px-3 font-mono text-sm text-[var(--text-strong)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--primary)]"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              title={showKey ? "Sembunyikan key" : "Lihat key"}
              className="h-12 shrink-0 rounded border border-[var(--border-input)] bg-[var(--input-bg)] px-3 text-[var(--text-mute)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              {showKey ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={handleDetect}
              disabled={detecting || !key.trim()}
              title="Deteksi provider & base URL dari key"
              className="h-12 shrink-0 rounded-full border border-[var(--primary)] px-5 text-sm font-bold tracking-[0.3px] text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--on-primary)] disabled:opacity-40"
            >
              {detecting ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                    <path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Deteksi…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">🔍 Deteksi</span>
              )}
            </button>
          </div>
          {detectInfo && (
            <p
              className={`mt-2 rounded border px-3 py-1.5 text-xs ${
                detectInfo.startsWith("✅")
                  ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
                  : "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]"
              }`}
            >
              {detectInfo}
            </p>
          )}
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--warning)]">{error}</p>}
      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-8 text-[15px] font-bold tracking-[0.45px] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-pressed)] active:bg-[var(--primary-active)] disabled:opacity-40 sm:w-auto"
        >
          {saving ? "Menyimpan…" : "Simpan Key"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}
