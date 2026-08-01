# 🔑 Cek API — Monitor API Key AI

Dashboard personal untuk **memeriksa API key AI** — apakah aktif/valid, model apa saja yang tersedia, sisa kuota, dan **tes model tertentu** bisa dipakai atau tidak.

> Dibuat dengan **Next.js 16** + **TypeScript** + **Tailwind CSS**.

---

## 📁 Struktur Project & Fungsi Tiap File

```
cek-api/
├── src/
│   ├── app/
│   │   ├── page.tsx                    ← Halaman dashboard utama
│   │   ├── layout.tsx                  ← Kerangka halaman (font, background)
│   │   ├── globals.css                 ← Styling global (dark theme)
│   │   └── api/
│   │       ├── keys/route.ts           ← API: kelola API key (tambah/hapus/list)
│   │       ├── check/route.ts          ← API: cek semua key (aktif/saldo/model)
│   │       ├── test-model/route.ts     ← API: tes 1 model tertentu
│   │       └── detect/route.ts         ← API: 🔍 deteksi provider dari key tak dikenal
│   ├── components/
│   │   ├── AddKeyForm.tsx              ← Form tambah API key baru
│   │   └── KeyCard.tsx                 ← Kartu status 1 key + fitur tes model
│   └── lib/
│       ├── types.ts                    ← Definisi semua tipe data
│       ├── providers.ts                ← Daftar provider AI + endpoint
│       ├── store.ts                    ← Penyimpanan key (file JSON + obfuscation)
│       ├── checkers.ts                 ← Logika cek key & tes model
│       └── cache.ts                    ← Cache hasil cek (hemat request)
├── data/                               ← (dibuat otomatis) isi: keys.json, cache.json
└── README.md                           ← Dokumentasi ini
```

---

## 🖥️ Halaman & Komponen UI

### `src/app/page.tsx` — Dashboard Utama
**Gunanya:** Halaman yang kamu lihat di `http://localhost:3000`.

| Bagian | Fungsi |
|---|---|
| `loadKeys()` | Ambil daftar key dari `/api/keys` saat halaman dibuka |
| `runCheck()` | Panggil `/api/check` buat cek semua key (aktif/tidak + saldo) |
| Auto-refresh | Otomatis cek ulang tiap **10 menit** |
| Statistik | Total key, Aktif, Invalid, Error |
| Render kartu | Tampilkan `KeyCard` untuk setiap key yang tersimpan |

### `src/components/AddKeyForm.tsx` — Form Tambah Key
**Gunanya:** Input API key baru.

- **Default provider = "Custom / Auto-detect"** — semua API bisa masuk
- Kolom **Base URL** (contoh: `https://vibe.madewgn.dev/v1`)
- Auto-detect **prefix key**: `pt-` → Puter, `sk-or-` → OpenRouter, `sk-ant-` → Anthropic, `gsk_` → Groq, `pplx-` → Perplexity, `AIza` → Gemini
- Tombol **🔍 Deteksi** — buat key tanpa prefix (mis. `I1sMj6UH.yYUE...`): app coba key ke **semua provider** secara paralel, yang jawab "valid" = provider & base URL-nya
- Tombol **Simpan Key** → POST ke `/api/keys`

### `src/components/KeyCard.tsx` — Kartu Status 1 Key
**Gunanya:** Menampilkan status & detail 1 API key.

| Fitur | Fungsi |
|---|---|
| Badge status | 🟢 Aktif / 🔴 Invalid / 🟠 Error |
| Sisa saldo | Tampil jika provider mendukung (OpenRouter, OpenAI) |
| List model | Model yang tersedia di API (bisa **diklik** → keisi kolom tes) |
| **Tes Model** | Input nama model → cek bisa dipakai atau tidak via `/api/test-model` |
| Tombol hapus | Hapus key dari penyimpanan |

---

## ⚙️ API Routes (Backend)

### `src/app/api/keys/route.ts` — Kelola API Key
| Method | Fungsi |
|---|---|
| `GET /api/keys` | List semua key (key di-*mask*: `sk-abc••••••••xyz`) + hasil cache |
| `POST /api/keys` | Simpan key baru (body: `providerId`, `label`, `key`, `baseUrl`) |
| `DELETE /api/keys?id=xxx` | Hapus key berdasarkan id |

### `src/app/api/check/route.ts` — Cek Semua Key
| Method | Fungsi |
|---|---|
| `GET /api/check` | Cek semua key (pakai cache 5 menit biar hemat) |
| `GET /api/check?refresh=1` | Paksa cek ulang (abaikan cache) |

### `src/app/api/test-model/route.ts` — Tes 1 Model
| Method | Fungsi |
|---|---|
| `POST /api/test-model` | Tes apakah model bisa dipakai (body: `keyId`, `model`) |
| `POST /api/detect` | Tebak provider & base URL dari key tak dikenal (body: `key`) |

### `src/app/api/detect/route.ts` — 🔍 Deteksi Provider
| Method | Fungsi |
|---|---|
| `POST /api/detect` | Tebak provider & base URL dari key yang tidak diketahui (body: `key`) |

---

## 🧠 Logic (src/lib)

### `src/lib/types.ts` — Tipe Data
**Gunanya:** Semua definisi tipe TypeScript yang dipakai di seluruh project.

| Tipe | Fungsi |
|---|---|
| `ProviderId` | ID provider (openrouter, openai, custom, dll) |
| `ApiKeyEntry` | Data 1 API key yang tersimpan |
| `CheckResult` | Hasil cek 1 key (status, saldo, model, pesan) |
| `ModelTestResult` | Hasil tes 1 model (bisa dipakai atau tidak) |

### `src/lib/providers.ts` — Daftar Provider
**Gunanya:** Registri semua provider AI yang didukung.

- Berisi base URL default, header auth, endpoint cek saldo
- **Custom** = base URL bebas (untuk API apapun)
- Mau tambah provider baru? Cukup tambah 1 entry di array `PROVIDERS`

### `src/lib/store.ts` — Penyimpanan Key
**Gunanya:** Simpan & baca API key dari file lokal.

| Fungsi | Kegunaan |
|---|---|
| `listKeys()` | List key (key di-mask, aman dikirim ke browser) |
| `getRawKey(id)` | Ambil key asli (hanya dipakai di server) |
| `addKey()` | Simpan key baru (di-obfuscate dulu) |
| `deleteKey(id)` | Hapus key |

> 🔒 **Keamanan:** Key disimpan di `data/keys.json` dalam keadaan **ter-enkripsi** (AES-256-GCM). Folder `data/` sudah di-`gitignore` supaya tidak ke-commit. Key lama (format XOR) otomatis di-migrasi saat pertama kali dibaca.

### `src/lib/checkers.ts` — Logika Cek
**Gunanya:** Otak dari project — yang melakukan pengecekan ke API provider.

| Fungsi | Kegunaan |
|---|---|
| `checkKey()` | Cek 1 key: valid? saldo? model apa aja? |
| `checkAllKeys()` | Cek banyak key sekaligus (paralel, 1 gagal tidak ganggu lain) |
| `testModel()` | Kirim chat kecil ("Say pong") untuk buktikan model bisa dipakai |
| `detectProvider()` | Coba key ke semua provider → ketahui provider & base URL |
| `probeModels()` | 🔬 Auto-probe: coba model populer (kimi-k3, gpt-4o-mini, dll) → lapor mana yang valid |
| `quickProbeModel()` | ⚡ Probe 1 model cepat (untuk model dari /models) |
| `probeModelList()` | 🔬 Probe banyak model paralel (concurrency 4) → urutkan aktif dulu |

**Robustness logic:**
- **Fallback path `/v1`** — kalau `baseUrl/models` 404, otomatis coba `baseUrl/v1/models` (panel gateway kayak 9router/New API butuh `/v1`)
- **Fallback chat test** — kalau endpoint `/models` nggak ada (404/405/501), validasi lewat chat kecil
- **🔬 Auto-probe model** — kalau `/models` gagal, app otomatis tes model populer dan nampilin di kartu mana yang ✅ Valid / ❌ Gagal (termasuk `moonshotai/kimi-k3`)
- **🔄 Model aktif duluan** — kalau `/models` sukses, model-modelnya di-probe & diurutkan: yang ✅ aktif tampil duluan, yang ❌ gagal di belakang
- **Retry `max_tokens`** — kalau model nolak `max_tokens` kecil (mis. Kimi K3), retry 64 → 256 → tanpa `max_tokens`
- **Multi-model fallback** — untuk provider custom, coba beberapa model umum sampai ada yang berhasil

### `src/lib/cache.ts` — Cache Hasil
**Gunanya:** Simpan hasil cek ke `data/cache.json` supaya tidak spam API provider.

- TTL default: **5 menit**
- Setiap refresh dalam 5 menit → pakai hasil lama (cepat)
- Tombol "Cek Sekarang" → paksa cek baru
- **Cache versioning** — kalau logika cek diubah, versi cache dinaikkan otomatis → hasil lama yang error tidak dipakai lagi

---

## 🚀 Cara Menjalankan

### 1. Setup Environment (sekali saja)

Salin `.env.example` jadi `.env`, lalu isi:

```powershell
copy .env.example .env
```

Isi variabel di `.env`:

| Variabel | Wajib? | Fungsi |
|---|---|---|
| `AUTH_PASSWORD` | ✅ | Password login dashboard (min 4 karakter) |
| `AUTH_SECRET` | ✅ | Kunci session + enkripsi key (min 16 karakter random) |
| `APP_URL` | ❌ | URL publik (dipakai script reset password), default `http://localhost:3000` |

Generate `AUTH_SECRET` random:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Jalankan

```powershell
cd d:\laragon\www\cek-api
npm install        # sekali saja
npm run dev        # mode development
```

Buka **http://localhost:3000** → login dengan `AUTH_PASSWORD`.

### Alur Pemakaian

1. **Login** → masukkan password dari `.env`
2. **Tambah key** → isi API key + base URL → Simpan
3. **Cek otomatis** → app cek key-nya valid/tidak, tampilkan saldo, model tersedia, & base URL yang dipakai
4. **Tes model** → ketik/klik nama model → tahu bisa dipakai atau tidak
5. **Refresh** → tombol "Cek Sekarang" untuk cek ulang paksa

---

## 🔒 Catatan Keamanan

- **JANGAN** commit folder `data/` (sudah di-gitignore) — isinya API key kamu
- Key hanya diproses di **server** (route handler), browser hanya lihat versi mask
- Key di-enkripsi **AES-256-GCM** at-rest (kunci turunan dari `AUTH_SECRET`)
- **Login wajib** — semua halaman & API diproteksi (session cookie httpOnly)
- **Rate limit** per IP di semua API route (anti spam/brute-force)

---

## ☁️ Deploy ke Server (VPS / Cloud)

Supaya bisa diakses dari mana saja:

1. **Set env vars** di server: `AUTH_PASSWORD`, `AUTH_SECRET` (kuat & unik!), `APP_URL`
2. **Build & start**:

```powershell
npm run build
npm start        # atau pakai pm2: npx pm2 start npm --name cek-api -- start
```

3. **HTTPS** — wajib pakai reverse proxy (Nginx/Caddy) + SSL cert supaya cookie session aman (cookie `secure` otomatis aktif di production)
4. **Lupa password?** Di server:

```powershell
npm run reset-password
```

→ muncul link sekali pakai (valid 10 menit) → buka di browser → set password baru → langsung berlaku tanpa restart

> [!WARNING]
> Jangan pernah commit `.env` — isinya rahasia (`AUTH_SECRET` dipakai buat enkripsi key; kalau bocor, semua key bisa didekripsi).

---

## ➕ Mau Tambah Provider?

Edit `src/lib/providers.ts`, tambah entry baru di array `PROVIDERS`:

```ts
{
  id: "nama-provider",
  name: "Nama Provider",
  baseUrl: "https://api.provider.com/v1",
  balanceType: "none",          // atau "usd" kalau ada endpoint saldo
  authHeader: "Authorization",
  authScheme: "Bearer",
}
```
