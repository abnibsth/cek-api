/**
 * 🗄️ Supabase REST API — Wrapper Tipis
 * -------------------------------------
 * Akses Supabase via REST (fetch built-in) — TANPA dependency tambahan.
 * Cukup untuk 2 table kecil (keys & auth) yang dipakai app ini.
 *
 * Env:
 *  - SUPABASE_URL         : https://xxxx.supabase.co
 *  - SUPABASE_SERVICE_KEY : service_role key (server-side only, bypass RLS)
 *
 * Semua fungsi async — route handler harus await.
 */
import type { ApiKeyEntry } from "./types";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

function base(): string {
  if (!URL || !KEY) {
    throw new Error(
      "SUPABASE_URL & SUPABASE_SERVICE_KEY belum diatur. Set di .env, lalu restart."
    );
  }
  return `${URL}/rest/v1`;
}

async function req<T>(
  path: string,
  init: RequestInit = {},
  accept: "json" | "empty" = "json"
): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${KEY!}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
  }
  if (accept === "empty") return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ── Table: keys ───────────────────────────────────────────── */

export interface KeyRow {
  id: string;
  provider_id: string;
  label: string;
  key: string;
  base_url?: string | null;
  created_at: string;
}

function rowToEntry(r: KeyRow): ApiKeyEntry {
  return {
    id: r.id,
    providerId: r.provider_id as ApiKeyEntry["providerId"],
    label: r.label,
    key: r.key,
    ...(r.base_url ? { baseUrl: r.base_url } : {}),
    createdAt: r.created_at,
  };
}

function entryToRow(e: ApiKeyEntry): KeyRow {
  return {
    id: e.id,
    provider_id: e.providerId,
    label: e.label,
    key: e.key,
    base_url: e.baseUrl ?? null,
    created_at: e.createdAt,
  };
}

export async function dbListKeys(): Promise<ApiKeyEntry[]> {
  const rows = await req<KeyRow[]>(`/keys?select=*&order=created_at.asc`);
  return (rows ?? []).map(rowToEntry);
}

export async function dbGetKey(id: string): Promise<ApiKeyEntry | undefined> {
  const rows = await req<KeyRow[]>(`/keys?select=*&id=eq.${id}&limit=1`);
  if (!rows || rows.length === 0) return undefined;
  return rowToEntry(rows[0]);
}

export async function dbAddKey(e: ApiKeyEntry): Promise<void> {
  await req(`/keys`, {
    method: "POST",
    body: JSON.stringify(entryToRow(e)),
  }, "empty");
}

export async function dbDeleteKey(id: string): Promise<void> {
  await req(`/keys?id=eq.${id}`, { method: "DELETE" }, "empty");
}

/* ── Table: auth (single row, id=1) ────────────────────────── */

export interface AuthRow {
  id: number;
  password_hash?: string | null;
  reset_token?: string | null;
  reset_expires?: number | null;
}

export async function dbGetAuth(): Promise<AuthRow> {
  const rows = await req<AuthRow[]>(`/auth?select=*&id=eq.1&limit=1`);
  return rows && rows.length > 0 ? rows[0] : { id: 1 };
}

export async function dbUpsertAuth(patch: Partial<AuthRow>): Promise<void> {
  await req(`/auth`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }, "empty");
}
