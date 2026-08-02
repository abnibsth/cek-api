/**
 * 📄 Dashboard Utama (Halaman Beranda)
 * -------------------------------------
 * Halaman yang tampil di http://localhost:3000.
 *
 * Fungsi:
 *  - Menampilkan daftar semua API key yang tersimpan (dalam bentuk kartu)
 *  - Menjalankan pengecekan otomatis: apakah key valid, sisa saldo, model tersedia
 *  - Statistik ringkas: total key, aktif, invalid, error
 *  - Auto-refresh setiap 10 menit + tombol "Cek Sekarang" untuk cek paksa
 *
 * Alur data:
 *  1. loadKeys()  → GET /api/keys    → ambil daftar key (masked)
 *  2. runCheck()  → GET /api/check   → cek semua key ke provider
 *  3. Hasil dirender sebagai <KeyCard> per key
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AddKeyForm from "@/components/AddKeyForm";
import KeyCard from "@/components/KeyCard";
import ThemeToggle from "@/components/ThemeToggle";
import type { CheckResult } from "@/lib/types";

interface KeyItem {
  id: string;
  providerId: string;
  providerName: string;
  label: string;
  baseUrl: string;
  maskedKey: string;
  createdAt: string;
  cachedResult: CheckResult | null;
}

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // auto refresh every 10 min

export default function Dashboard() {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/keys", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setKeys(data.keys ?? []);
      const resultMap: Record<string, CheckResult> = {};
      for (const k of data.keys ?? []) {
        if (k.cachedResult) resultMap[k.id] = k.cachedResult;
      }
      setResults(resultMap);
    } catch {
      setError("Gagal memuat daftar key");
    } finally {
      setLoading(false);
    }
  }, []);

  const runCheck = useCallback(
    async (refresh: boolean) => {
      setChecking(true);
      setError(null);
      try {
        const res = await fetch(`/api/check${refresh ? "?refresh=1" : ""}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Gagal mengecek key (${res.status})`);
          return;
        }
        const data = await res.json();
        const resultMap: Record<string, CheckResult> = {};
        for (const r of data.results ?? []) {
          if (r.keyId) resultMap[r.keyId] = r;
        }
        setResults(resultMap);
        setLastChecked(data.checkedAt);
      } catch {
        setError("Gagal mengecek key");
      } finally {
        setChecking(false);
      }
    },
    // Tanpa dependensi keys — timer pakai closure stabil, nggak di-reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // initial load + auto refresh
  useEffect(() => {
    loadKeys();
    timerRef.current = setInterval(() => {
      loadKeys();
      runCheck(false);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadKeys, runCheck]);

  // run a check automatically once keys are loaded
  const didAutoCheck = useRef(false);
  useEffect(() => {
    if (!loading && keys.length > 0 && !didAutoCheck.current) {
      didAutoCheck.current = true;
      runCheck(false);
    }
  }, [loading, keys.length, runCheck]);

  async function handleDelete(id: string) {
    if (!confirm("Hapus API key ini?")) return;
    const res = await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const statusCounts = keys.reduce(
    (acc, k) => {
      const s = results[k.id]?.status ?? "pending";
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-8 pt-safe sm:gap-16 sm:px-6 sm:py-12">
      {/* Header */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/image.png"
            alt="Cek API"
            className="h-12 w-12 rounded-lg object-contain sm:h-14 sm:w-14"
          />
          <div className="min-w-0">
            <h1 className="text-3xl font-light tracking-tight text-[var(--text-strong)] sm:text-5xl">
              Cek <span className="text-[var(--primary)]">API</span>
            </h1>
            <p className="mt-2 text-sm text-[var(--text-body)] sm:text-base">
              Pantau validitas & sisa kuota semua API key AI-mu dalam satu layar
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            title="Keluar"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-input)] bg-[var(--card)] text-[var(--text-body)] transition-colors hover:border-[var(--warning-border)] hover:text-[var(--warning)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
          {lastChecked && (
            <span className="text-xs text-[var(--text-mute)]">
              Terakhir cek:{" "}
              {new Date(lastChecked).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={() => runCheck(true)}
            disabled={checking || keys.length === 0}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--primary)] px-7 text-[15px] font-bold tracking-[0.45px] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-pressed)] active:bg-[var(--primary-active)] disabled:opacity-40"
          >
            {checking ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                  <path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Mengecek…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
                Cek Sekarang
              </>
            )}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
          {error}
        </div>
      )}

      {/* Summary stats */}
      {keys.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Key" value={keys.length} accent="text-[var(--text-strong)]" />
          <StatCard label="Aktif" value={statusCounts.ok ?? 0} accent="text-[var(--success)]" />
          <StatCard label="Invalid" value={statusCounts.invalid ?? 0} accent="text-[var(--warning)]" />
          <StatCard label="Error" value={statusCounts.error ?? 0} accent="text-[var(--error)]" />
        </div>
      )}

      {/* Add form */}
      <AddKeyForm
        onAdded={async () => {
          await loadKeys();
          await runCheck(true);
        }}
      />

      {/* Key cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--text-mute)]">
          <svg className="mr-2 animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
            <path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Memuat…
        </div>
      ) : keys.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {keys.map((k) => (
            <KeyCard
              key={k.id}
              keyId={k.id}
              providerName={k.providerName}
              label={k.label}
              baseUrl={k.baseUrl}
              maskedKey={k.maskedKey}
              result={results[k.id] ?? null}
              onDelete={() => handleDelete(k.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface)] px-5 py-4">
      <p className={`text-3xl font-light tracking-tight ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--text-mute)]">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-[var(--border-input)] bg-[var(--card)] px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-soft)] text-2xl">
        🔑
      </div>
      <div>
        <h3 className="text-xl font-light text-[var(--text-strong)]">Belum ada API key</h3>
        <p className="mt-1 max-w-sm text-sm text-[var(--text-body)]">
          Tambahkan API key pertamamu lewat form di atas — key akan tersimpan
          aman di server lokalmu, lalu langsung dicek otomatis.
        </p>
      </div>
    </div>
  );
}
