# AntreKu — Sistem Antrean & Booking Layanan Real-Time

Aplikasi web sistem antrean digital & booking jadwal layanan secara **real-time** menggunakan Server-Sent Events (SSE) tanpa dependensi eksternal — siap dijalankan untuk **Klinik Kesehatan**, **Barbershop**, maupun **Pusat Layanan Servis**.

## Fitur Utama

1. **Portal Pelanggan Mobile-First (`/`)**
   - Pilih layanan beserta jumlah antrean aktif & estimasi waktu tunggu secara langsung.
   - Mode **Antre Sekarang (Walk-In)** maupun **Booking Jadwal Jam** (dengan tombol *Check-In Mandiri* saat tiba di lokasi).
   - **Tiket Digital Live**: Menampilkan nomor antrean besar, sisa antrean di depan Anda, estimasi waktu tunggu, QR Code tiket, dan notifikasi otomatis (suara bel, getar HP, & notifikasi browser) begitu nomor dipanggil oleh admin.
   - Papan mini status loket & antrean berikutnya secara real-time.

2. **Dasbor Admin & Operator (`/admin`)**
   - Dilindungi PIN Operator (default PIN: `1234`, dapat diubah di Pengaturan).
   - **Meja Panggilan (Call Station)**: Pilih loket/kursi/poli aktif, tombol utama **Panggil Berikutnya**, **Mulai Layani** (dengan timer durasi otomatis), **Panggil Ulang**, **Selesai**, dan **Lewati (Skip)**.
   - **Manajemen Booking Jadwal**: Check-in pelanggan yang sudah booking atau panggil langsung.
   - **Manajemen Layanan & Loket (CRUD)**: Tambah/ubah kode layanan, durasi, harga, petugas, dan status loket.
   - **Switcher Preset Bisnis 1-Klik**: Ubah seluruh tampilan, layanan, loket, dan warna tema secara instan antara *Klinik Kesehatan*, *Barbershop Modern*, dan *Pusat Layanan Servis*.
   - **QR Code Akses Pelanggan** (otomatis mendeteksi IP LAN Wi-Fi agar pelanggan bisa langsung scan dari HP).

3. **Layar Monitor TV Ruang Tunggu (`/display`)**
   - Tampilan layar lebar kontras tinggi (dark mode) dengan jam digital live.
   - Sorotan utama **Sedang Dipanggil** dengan animasi kilas & pengumuman suara bel + **Text-to-Speech Bahasa Indonesia** otomatis (*"Nomor antrean A, kosong kosong empat, silakan menuju Poli Umum 1"*).
   - Daftar seluruh loket aktif, antrean berikutnya (*Up Next*), serta QR Code untuk scan langsung dari HP.

## Cara Menjalankan

Pastikan Node.js (versi 20 atau lebih baru) sudah terpasang, lalu jalankan:

```bash
cd C:\Users\HP\.gemini\antigravity\scratch\antreku
npm start
```

Akses melalui browser:
- **Portal Pelanggan (HP):** `http://localhost:3100/`
- **Dasbor Admin (PIN: 1234):** `http://localhost:3100/admin`
- **Layar TV Ruang Tunggu:** `http://localhost:3100/display`

## Menjalankan Pengujian Otomatis

```bash
npm test
```
