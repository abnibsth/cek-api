/**
 * 🃏 Kartu Status API Key
 * -----------------------
 * Satu kartu yang mewakili SATU API key yang tersimpan.
 *
 * Fungsi:
 *  - Menampilkan status key: 🟢 Aktif / 🔴 Invalid / 🟠 Error / ⏳ Cek…
 *  - Menampilkan sisa saldo (jika provider mendukung, mis. OpenRouter)
 *  - Menampilkan daftar model yang tersedia di API
 *  - FITUR TES MODEL: ketik/klik nama model → kirim chat kecil ke API
 *    untuk membuktikan model tersebut benar-benar bisa dipakai
 *  - Tombol hapus key
 *
 * Props:
 *  - keyId        : id key (dipakai untuk tes model)
 *  - providerName : nama provider (mis. "Custom / Auto-detect")
 *  - label        : label yang diberikan user
 *  - maskedKey    : key versi mask (sk-abc••••••••xyz) — aman ditampilkan
 *  - result       : hasil pengecekan terakhir (CheckResult | null)
 *  - onDelete     : callback saat tombol hapus diklik
 */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CheckResult, ModelTestResult } from "@/lib/types";

const STATUS_META: Record<
  string,
  { label: string; color: string; dot: string; ring: string; badge: string }
> = {
  ok: {
    label: "Aktif",
    color: "text-[var(--success)]",
    dot: "bg-[var(--success)]",
    ring: "ring-[var(--success)]/20",
    badge: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success-border)]",
  },
  invalid: {
    label: "Invalid",
    color: "text-[var(--warning)]",
    dot: "bg-[var(--warning)]",
    ring: "ring-[var(--warning)]/20",
    badge: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning-border)]",
  },
  error: {
    label: "Error",
    color: "text-[var(--error)]",
    dot: "bg-[var(--error)]",
    ring: "ring-[var(--error)]/20",
    badge: "bg-[var(--error-soft)] text-[var(--error)] border-[var(--error-border)]",
  },
  checking: {
    label: "Cek…",
    color: "text-[var(--primary)]",
    dot: "bg-[var(--primary)] animate-pulse",
    ring: "ring-[var(--primary)]/20",
    badge: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30",
  },
  pending: {
    label: "Menunggu",
    color: "text-[var(--text-mute)]",
    dot: "bg-[var(--text-disabled)]",
    ring: "ring-[var(--text-disabled)]/30",
    badge: "bg-[var(--surface-soft)] text-[var(--text-mute)] border-[var(--hairline)]",
  },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function KeyCard({
  keyId,
  providerName,
  label,
  baseUrl,
  maskedKey,
  result,
  onDelete,
}: {
  keyId: string;
  providerName: string;
  label: string;
  baseUrl: string;
  maskedKey: string;
  result: CheckResult | null;
  onDelete: () => void;
}) {
  const meta = STATUS_META[result?.status ?? "pending"] ?? STATUS_META.pending;
  const [testModelName, setTestModelName] = useState("");
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  // Hasil test MANUAL yang meng-override status probe server
  // (model → ok? true = aktif, false = gagal)
  const [manualResults, setManualResults] = useState<Record<string, boolean>>({});

  // Auto-lacak: tes SEMUA model sekali pencet (berurutan, chip update live)
  const [tracking, setTracking] = useState(false);
  const [trackProgress, setTrackProgress] = useState<{
    done: number;
    total: number;
    ok: number;
    fail: number;
    current: string;
  } | null>(null);
  const [trackSummary, setTrackSummary] = useState<{
    ok: number;
    fail: number;
    rateLimited: boolean;
  } | null>(null);
  const trackingRef = useRef(false);

  // Status model: true = aktif ✅, false = gagal ❌, undefined = belum tau
  function modelStatus(model: string): boolean | undefined {
    if (model in manualResults) return manualResults[model];
    const probe = result?.probedModels?.find((p) => p.model === model);
    return probe?.ok;
  }

  // Urutkan: aktif dulu, belum-tau tengah, gagal terakhir
  const sortedAll = useMemo(() => {
    const ids = result?.modelIds ?? result?.modelSamples ?? [];
    // Tambahkan model hasil test manual yang belum ada di daftar
    const merged = [...ids];
    for (const m of Object.keys(manualResults)) {
      if (!merged.includes(m)) merged.push(m);
    }
    const rank = (s?: boolean) => (s === true ? 0 : s === false ? 2 : 1);
    return [...merged].sort((a, b) => rank(modelStatus(a)) - rank(modelStatus(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, manualResults]);

  // Default view: sembunyikan yang GAGAL & batasi jumlah biar kartu nggak kepanjangan
  // (OpenRouter bisa punya ratusan model → tampilkan maks 8, sisanya di "Lihat semua")
  const DEFAULT_VISIBLE_LIMIT = 8;
  const visibleModels = showAllModels
    ? sortedAll
    : sortedAll.filter((m) => modelStatus(m) !== false).slice(0, DEFAULT_VISIBLE_LIMIT);

  async function handleTestModel(e: React.FormEvent) {
    e.preventDefault();
    const model = testModelName.trim();
    if (!model) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, model }),
      });
      const data = await res.json();
      const ok = data.result?.ok ?? false;
      setTestResult(data.result ?? { model, ok: false, message: "Gagal tes model" });
      // Hasil test manual langsung update status chip:
      // ok → hijau + naik ke atas, gagal → merah + turun ke bawah
      setManualResults((prev) => ({ ...prev, [model]: ok }));
    } catch {
      setTestResult({ model, ok: false, message: "Gagal terhubung ke server" });
      setManualResults((prev) => ({ ...prev, [model]: false }));
    } finally {
      setTesting(false);
    }
  }

  // Jumlah model yang belum diketahui statusnya (target auto-lacak)
  const untestedCount = sortedAll.filter((m) => modelStatus(m) === undefined).length;

  const handleTrackAll = useCallback(async () => {
    const targets = sortedAll.filter((m) => modelStatus(m) === undefined);
    if (targets.length === 0 || trackingRef.current) return;
    setShowAllModels(false);
    setTrackSummary(null);
    trackingRef.current = true;
    setTracking(true);

    let okCount = 0;
    let failCount = 0;
    let done = 0;
    let rateLimited = false;

    // Worker pool: 2 request paralel biar cepat tapi nggak kena rate-limit
    const CONCURRENCY = 2;
    let cursor = 0;
    async function worker() {
      while (cursor < targets.length && trackingRef.current) {
        const idx = cursor++;
        const model = targets[idx];
        if (modelStatus(model) !== undefined) continue; // sudah diketahui
        try {
          const res = await fetch("/api/test-model", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keyId, model }),
          });
          const data = await res.json();
          const ok = data.result?.ok ?? false;
          if (data.result?.status === 429) rateLimited = true;
          setManualResults((prev) => ({ ...prev, [model]: ok }));
          if (ok) okCount++;
          else failCount++;
        } catch {
          setManualResults((prev) => ({ ...prev, [model]: false }));
          failCount++;
        }
        done++;
        setTrackProgress({
          done,
          total: targets.length,
          ok: okCount,
          fail: failCount,
          current: model,
        });
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker())
    );

    trackingRef.current = false;
    setTracking(false);
    setTrackProgress(null);
    if (rateLimited) {
      setTrackSummary({ ok: okCount, fail: failCount, rateLimited: true });
    } else {
      setTrackSummary({ ok: okCount, fail: failCount, rateLimited: false });
    }
  }, [keyId, sortedAll, manualResults]);

  return (
    <div className="animate-in flex flex-col gap-3 rounded-lg border border-[var(--hairline)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="relative shrink-0">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-soft)] text-sm font-bold text-[var(--text-strong)] ring-1 ${meta.ring}`}
            >
              {providerName.slice(0, 2).toUpperCase()}
            </div>
            <span
              className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ${meta.dot} ring-2 ring-[var(--card)]`}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-strong)]">{label}</p>
            <p className="truncate text-xs text-[var(--text-mute)]">{providerName}</p>
          </div>
        </div>
        <button
          onClick={onDelete}
          title="Hapus key"
          className="shrink-0 rounded-md p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--warning-soft)] hover:text-[var(--warning)] active:scale-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-[var(--surface-soft)] px-2.5 py-1 font-mono text-xs text-[var(--text-mute)]">
          {maskedKey}
        </code>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
        >
          {meta.label}
        </span>
      </div>

      {/* Base URL */}
      {baseUrl && (
        <div className="flex items-center gap-1.5 rounded border border-[var(--hairline)] bg-[var(--card)] px-2.5 py-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--text-faint)]">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          <span className="truncate font-mono text-[11px] text-[var(--text-mute)]" title={baseUrl}>
            {baseUrl}
          </span>
        </div>
      )}

      {/* Result details */}
      <div className="flex flex-col gap-2">
        {result ? (
          <>
            {result.balanceDisplay && (
              <div className="flex items-center justify-between rounded bg-[var(--success-soft)] px-3 py-2">
                <span className="text-xs text-[var(--text-mute)]">Sisa saldo</span>
                <span className="text-lg font-light tracking-tight text-[var(--success)]">
                  {result.balanceDisplay}
                </span>
              </div>
            )}
            {result.modelCount !== undefined && result.modelCount > 0 && (
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs text-[var(--text-faint)]">Model tersedia</span>
                <span className="text-sm font-medium text-[var(--text-strong)]">
                  {result.modelCount}
                </span>
              </div>
            )}
            {visibleModels.length > 0 && (
              <div className="flex flex-wrap gap-1 px-3">
                {visibleModels.map((m) => {
                  const status = modelStatus(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        setTestModelName(m);
                        setShowAllModels(false);
                      }}
                      title={`Tes model: ${m}`}
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                        status === true
                          ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)] hover:border-[var(--success)]"
                          : status === false
                            ? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]/80 hover:border-[var(--warning)]"
                            : "border-[var(--hairline)] bg-[var(--card)] text-[var(--text-mute)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      }`}
                    >
                      {status === true ? "✅ " : status === false ? "❌ " : ""}
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Auto-lacak semua model */}
            <div className="flex flex-col gap-2 px-3">
              {tracking && trackProgress ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-mute)]">
                      <svg className="shrink-0 animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                        <path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <span className="truncate">
                        Melacak {trackProgress.done + 1}/{trackProgress.total} • {trackProgress.current}
                      </span>
                    </span>
                    <button
                      onClick={() => {
                        trackingRef.current = false;
                      }}
                      title="Hentikan auto-lacak"
                      className="shrink-0 rounded-full border border-[var(--warning-border)] bg-[var(--warning-soft)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--warning)] transition-colors hover:border-[var(--warning)]"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="5" y="5" width="14" height="14" rx="2" />
                      </svg>
                      <span className="ml-1">Hentikan</span>
                    </button>
                  </div>
                  {/* Progress bar flat ala PS — tanpa gradient */}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                      style={{ width: `${(trackProgress.done / trackProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--text-faint)]">
                    ✅ {trackProgress.ok} aktif • ❌ {trackProgress.fail} gagal
                  </p>
                </>
              ) : untestedCount > 0 ? (
                <button
                  onClick={handleTrackAll}
                  title="Tes semua model yang belum dilacak, berurutan otomatis"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--primary)] bg-[var(--primary)]/5 px-3 py-1.5 text-[11px] font-bold tracking-[0.3px] text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--on-primary)]"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Lacak semua ({untestedCount} model belum dicek)
                </button>
              ) : trackSummary ? (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-[var(--text-faint)]">
                    ✅ {trackSummary.ok} aktif • ❌ {trackSummary.fail} gagal dari{" "}
                    {trackSummary.ok + trackSummary.fail} model
                  </p>
                  {trackSummary.rateLimited && (
                    <p className="text-[10px] text-[var(--error)]">
                      ⚠️ Terkena rate-limit — coba lagi nanti
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            {(showAllModels || sortedAll.length > visibleModels.length) && (
              <div className="px-3">
                <button
                  onClick={() => setShowAllModels((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--card)] px-3 py-1 text-[11px] font-medium text-[var(--primary)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                >
                  {showAllModels ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                      Persingkat tampilan
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      Lihat semua ({sortedAll.length} model)
                    </>
                  )}
                </button>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-[var(--hairline)] pt-2">
              <p className="text-xs text-[var(--text-faint)]">
                {result.message}
                {result.latencyMs ? ` • ${result.latencyMs}ms` : ""}
              </p>
              <p className="text-[10px] text-[var(--text-disabled)]">{formatTime(result.checkedAt)}</p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-faint)]">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
              <path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Menunggu pengecekan…
          </div>
        )}
      </div>

      {/* Model test */}
      <form
        onSubmit={handleTestModel}
        className="flex flex-col gap-2 border-t border-[var(--hairline)] pt-3"
      >
        <label className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-faint)]">
          Tes Model
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={testModelName}
            onChange={(e) => setTestModelName(e.target.value)}
            placeholder="contoh: deepseek-chat"
            className="min-w-0 flex-1 rounded border border-[var(--border-input)] bg-[var(--input-bg)] px-2.5 py-2 font-mono text-xs text-[var(--text-strong)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--primary)] sm:py-1.5"
          />
          <button
            type="submit"
            disabled={testing || !testModelName.trim()}
            className="shrink-0 rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-bold tracking-[0.3px] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-pressed)] active:bg-[var(--primary-active)] disabled:opacity-40 sm:py-1.5"
          >
            {testing ? "Tes…" : "Tes"}
          </button>
        </div>
        {testResult && (
          <div
            className={`rounded border px-2.5 py-1.5 text-xs ${
              testResult.ok
                ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
                : "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]"
            }`}
          >
            <p className="font-medium">
              {testResult.ok ? "✅ Bisa dipakai" : `❌ ${testResult.message}`}
              {testResult.latencyMs ? ` • ${testResult.latencyMs}ms` : ""}
            </p>
            {testResult.sample && (
              <p className="mt-0.5 truncate text-[11px] opacity-80">
                Respons: {testResult.sample}
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
