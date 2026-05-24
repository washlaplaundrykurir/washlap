# Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-05-23

### Security
- **SEC-04** Fix open redirect di Google auth — `redirectTo` sekarang divalidasi, hanya path `/admin` dan `/kurir` yang diizinkan. URL eksternal ditolak.
- **SEC-07** Hapus default password `12345678` — password sekarang wajib diisi minimal 8 karakter saat buat user baru

### Fixed
- **LOGIC-01** Race condition konfirmasi order — setelah update, cek status terkini di DB. Jika sudah dikonfirmasi oleh admin lain (status bukan 6), return 409 Conflict
- **LOGIC-02** Error insert status log tidak lagi diabaikan — error dicatat ke console agar bisa dideteksi
- **LOGIC-03** Kurir tidak bisa lagi set status "Dibatalkan" (7) — API sekarang hanya izinkan status 3 dan 5 dari kurir. Tombol "Dibatalkan" dihapus dari halaman kurir

---



### Security (Critical Fixes)
- **SEC-01** Tambahkan autentikasi ke semua API route sensitif menggunakan helper `lib/api-auth.ts`
  - `/api/tasks` (GET, PUT) — hanya admin
  - `/api/users` (GET, POST, PUT, DELETE) — hanya admin
  - `/api/reports` (GET) — hanya admin
  - `/api/orders/list` (GET) — hanya admin
  - `/api/orders/update` (PUT) — hanya admin
  - `/api/orders/confirm` (PUT) — hanya admin
  - `/api/orders/[orderId]/logs` (GET) — hanya admin
  - `/api/logs` (GET) — hanya admin
  - `/api/customers` (GET, PUT, DELETE) — hanya admin
  - `/api/couriers` (GET) — hanya admin
  - `/api/statuses` (GET) — hanya admin
  - `/api/admin/promo` PUT — hanya admin (GET tetap publik untuk halaman customer)
  - `/api/admin/promo/upload` (POST) — hanya admin
  - `/api/kurir/tasks` (GET, PUT) — hanya kurir
  - `/api/kurir/report` (GET) — hanya kurir
- **SEC-02** Ganti `jwtDecode()` dengan `supabase.auth.getUser()` di semua auth check — token palsu tidak lagi diterima
  - `utils/supabase/middleware.ts` — middleware utama
  - `lib/api-auth.ts` — helper baru untuk semua API routes
  - `app/api/kurir/tasks/route.ts`
  - `app/api/kurir/report/route.ts`
  - `app/api/users/me/route.ts`
- **SEC-03** Hapus `/api/debug/log` endpoint yang terbuka di production
- **SEC-06** Validasi tipe MIME dan ukuran file di upload promo (maks 5MB, hanya JPEG/PNG/WebP/GIF)

### Added
- `lib/api-auth.ts` — utility helper untuk autentikasi API: `requireAdmin()`, `requireKurir()`, `requireLogin()`, `requireSuperAdmin()`

---



### Added
- Fitur auto-fill data customer berdasarkan nomor HP di form order (customer & admin)
  - Input nomor HP dipindah ke posisi paling atas form
  - Debounce 600ms + lookup otomatis ke `/api/customers/lookup`
  - Modal konfirmasi "Gunakan data tersimpan?" sebelum auto-fill
  - Loading indicator "mencari..." saat lookup berlangsung
  - Data yang di-fill (nama, alamat, gmaps) tetap bisa diedit manual
- API endpoint `GET /api/customers/lookup` dengan rate limiting 15 req/menit per IP
- Rate limiter utility `lib/rate-limit.ts` (in-memory)

### Fixed
- Bug error prod: upsert customer gagal karena CHECK constraint aktif sebelum normalisasi di API siap
- Normalisasi nomor HP di `api/orders/route.ts` dan `api/orders/update/route.ts` sebelum upsert ke DB

### Changed
- Normalisasi & pembersihan data nomor HP di database:
  - Merge ~208 customer duplikat (format berbeda, orang sama)
  - 365 nomor dinormalisasi ke format `08xxx`
  - CHECK constraint ditambahkan: hanya format `08[0-9]{8,11}` yang diterima
  - Data tidak valid diberi prefix `INVALID-{id}`

---



### Fixed
- Fix bug `waktu_penjemputan` tersimpan salah timezone (WIB di-append `Z` langsung, seharusnya `+07:00`)
- Fix kalkulasi SLA menggunakan jam operasional UTC, seharusnya WIB (UTC+7)
- Fix form edit order: load `waktu_penjemputan` dari DB dikonversi ke WIB sebelum ditampilkan di input

### Changed
- `lib/sla-helper.ts`: `calculateActiveMinutes` sekarang menghitung jam operasional dalam WIB
- Update 4.492 baris data lama `waktu_penjemputan` dikurangi 7 jam di database
- Recalculate semua nilai SLA (`sla_tiket_menit`, `sla_kurir_menit`, `sla_nota_menit`) dengan logika WIB yang benar

### Added
- Teks keterangan pada checkbox "Antar" di form customer: "Permintaan antar dapat disampaikan setelah anda mendapatkan pemberitahuan penyelesaian transaksi dari admin"
- Validasi cancel tiket: tiket yang sudah ditugaskan (status >= 2) tidak dapat dibatalkan
- Guard di API `orders/update`: tolak cancel jika status order sudah >= 2
- Support versioning: versi tampil di sidebar admin

---

## [1.0.0] - 2026-01-12

### Added
- Rilis awal sistem manajemen laundry Washlap
- Dashboard admin dengan manajemen order, kurir, pelanggan, dan laporan SLA
- Halaman kurir untuk menerima dan menyelesaikan tugas
- Form order customer dengan notifikasi WhatsApp
- Sistem promo dengan upload gambar
- Laporan SLA tiket, kurir, dan nota
- Export laporan ke Excel
