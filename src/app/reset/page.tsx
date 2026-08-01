/**
 * 🔄 Halaman Reset Password
 * -------------------------
 * Diakses lewat link sekali pakai dari terminal:
 *   npm run reset-password → buka /reset?token=xxx
 * Isi password baru → langsung berlaku (tanpa restart server).
 */
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Token reset tidak ditemukan di URL. Jalankan ulang npm run reset-password.");
      return;
    }
    if (password.length < 4) {
      setError("Password minimal 4 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Password tidak sama");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal reset password");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Terjadi kesalahan jaringan");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-soft)] text-2xl">
          ✅
        </div>
        <div>
          <h2 className="text-xl font-light text-[var(--text-strong)]">Password berhasil diubah!</h2>
          <p className="mt-1 text-sm text-[var(--text-body)]">
            Sekarang masuk dengan password baru.
          </p>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--primary)] px-8 text-[15px] font-bold tracking-[0.45px] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-pressed)]"
        >
          Ke halaman login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-light tracking-tight text-[var(--text-strong)]">
            Reset <span className="text-[var(--primary)]">Password</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--text-body)]">
            Masukkan password baru untuk menggantikan yang lama
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-[var(--hairline)] bg-[var(--card)] p-6"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--text-mute)]">Password baru</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 4 karakter"
              className="h-12 w-full rounded border border-[var(--border-input)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-strong)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--primary)]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--text-mute)]">Ulangi password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ketik ulang password baru"
              className="h-12 w-full rounded border border-[var(--border-input)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-strong)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--primary)]"
            />
          </label>

          {error && (
            <p className="rounded border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-8 text-[15px] font-bold tracking-[0.45px] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-pressed)] active:bg-[var(--primary-active)] disabled:opacity-40"
          >
            {loading ? "Menyimpan…" : "Simpan Password Baru"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
