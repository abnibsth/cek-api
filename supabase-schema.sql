-- ============================================================
-- 🗄️ Cek API — Supabase Schema Migration
-- ============================================================
-- Jalankan SQL ini di Supabase Dashboard → SQL Editor
-- Bikin 2 table: "keys" & "auth"
--
-- Cara pakai:
--   1. Buka https://supabase.com/dashboard
--   2. Pilih project kamu → SQL Editor → New Query
--   3. Copy-paste seluruh SQL di bawah → Run
-- ============================================================

-- ── Table: keys ─────────────────────────────────────────────
-- Nyimpen API key (terenkripsi AES-256-GCM)
CREATE TABLE IF NOT EXISTS keys (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  label       TEXT NOT NULL,
  key         TEXT NOT NULL,           -- encrypted (aes:...)
  base_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query by id (sudah PK) & order by created_at
CREATE INDEX IF NOT EXISTS idx_keys_created_at ON keys (created_at ASC);

-- ── Table: auth ────────────────────────────────────────────
-- Nyimpen password hash & reset token (single row, id=1)
CREATE TABLE IF NOT EXISTS auth (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  password_hash TEXT,
  reset_token   TEXT,
  reset_expires BIGINT,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert row default (id=1) kalau belum ada
INSERT INTO auth (id, password_hash, reset_token, reset_expires)
VALUES (1, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Enable RLS (Row Level Security) ─────────────────────────
-- Karena kita pakai service_role key (bypass RLS), ini extra safety.
ALTER TABLE keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth ENABLE ROW LEVEL SECURITY;

-- Service role bypass RLS otomatis, jadi nggak perlu policy tambahan.
-- Tapi kalau mau baca pakai anon key (read-only public), uncomment:
-- CREATE POLICY "read keys" ON keys FOR SELECT TO anon USING (false);
-- (false = block semua anon access, hanya service_role yang bisa)

-- ============================================================
-- ✅ Selesai! 2 table siap dipakai.
-- ============================================================
