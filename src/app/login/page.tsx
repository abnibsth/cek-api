/**
 * 🔑 Halaman Login
 * ----------------
 * Form password tunggal — akses ke dashboard.
 * Redirect ke / setelah sukses.
 * Desain flat ala PlayStation (tanpa gradient/glow/shadow).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Password wajib diisi");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal login");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/image.png"
            alt="Cek API"
            className="mx-auto mb-4 h-14 w-14 rounded-lg object-contain"
          />
          <h1 className="text-4xl font-light tracking-tight text-[var(--text-strong)]">
            Cek <span className="text-[var(--primary)]">API</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--text-body)]">
            Masuk untuk memantau API key AI-mu
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-[var(--hairline)] bg-[var(--card)] p-6"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--text-mute)]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
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
            {loading ? "Memverifikasi…" : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--text-faint)]">
          Lupa password? Jalankan{" "}
          <code className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 font-mono text-[11px]">
            npm run reset-password
          </code>{" "}
          di server.
        </p>
      </div>
    </div>
  );
}
