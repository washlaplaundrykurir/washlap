# Changelog

Semua perubahan penting pada proyek ini akan didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-05-23

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
