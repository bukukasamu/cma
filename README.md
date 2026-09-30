# Kas Aceh Mandiri Utama · v2.2.0

Buku kas multi-cabang untuk Aceh Mandiri Utama. Situs statis di GitHub Pages, data dan login di Firebase (Authentication + Firestore). Cukup dengan paket gratis Firebase (Spark). Bisa dipasang di HP sebagai aplikasi (PWA).

## Siapa bisa apa

| | Owner | Kasir cabang |
|---|---|---|
| Ringkasan & insight semua cabang | Ya | Cabangnya sendiri |
| Tambah cabang + buat login kasir | Ya | Tidak |
| Kelola kategori (tambah/hapus) | Ya | Hanya memilih |
| Catat uang masuk/keluar | Semua cabang | Cabangnya sendiri |
| Edit & hapus transaksi (termasuk yang dicatat kasir) | Ya | Tidak |
| Kwitansi PDF | Ya | Ya |
| Edit nama/alamat cabang | Ya | Tidak |
| Unduh laporan Excel & PDF | Rekap semua cabang + per cabang | Cabangnya sendiri |
| Ubah password sendiri | Ya | Ya |
| Log aktivitas | Melihat semua | Tercatat otomatis |

Batasan ini dijaga oleh `firestore.rules` di server Firebase, termasuk: kasir hanya bisa memakai kategori yang ditetapkan owner.

## Pemasangan

### 1. Firebase (proyek `cashflow-amu`)
1. **Authentication → Sign-in method →** aktifkan **Email/Password**.
2. **Authentication → Users → Add user**: buat akun owner `cashflow.amu@gmail.com`.
3. **Firestore Database → Create database** (lokasi `asia-southeast2` Jakarta), mode production.
4. **Firestore Database → Rules**: tempel isi `firestore.rules`, lalu **Publish**. Ulangi setiap kali file ini berubah.

`firebase-config.js` sudah terisi untuk proyek ini. Jika email owner diganti, ubah juga di `firestore.rules`.

### 2. GitHub Pages
1. Unggah semua file (termasuk folder `icons/`) ke root repository, branch `main`.
2. **Settings → Pages → Source: Deploy from a branch →** `main` / `(root)` → **Save**.
3. Firebase: **Authentication → Settings → Authorized domains → Add domain** → `<username>.github.io`.

### 3. Mulai pakai
1. Masuk dengan email owner. Kategori bawaan dibuat otomatis saat owner pertama kali masuk.
2. Menu **Cabang**: isi nama cabang, nama kasir, username, dan password awal. Cabang dan login kasir dibuat sekaligus.
3. Berikan username + password ke kasir. Kasir masuk dengan **username** saja (tanpa @), lalu sebaiknya mengganti password lewat tombol akun (pojok kanan atas) → **Ubah password**.

## Catatan penting
- **Kasir lupa password:** login berbasis username tidak punya email untuk reset. Owner cukup menonaktifkan login lama dan membuat login baru di menu Cabang.
- **Tanpa lampiran file:** uang keluar tidak menyimpan foto/PDF agar kuota Firestore hemat. Kwitansi PDF dibuat langsung dari data transaksi.
- **Hemat kuota:** data disimpan juga di perangkat (cache Firestore), jadi membuka ulang aplikasi tidak selalu membaca ulang semua data. Log aktivitas hanya dimuat saat menu Aktivitas dibuka.
- `firebaseConfig`/`apiKey` memang aman terlihat publik; yang melindungi data adalah `firestore.rules`. Lapisan tambahan: batasi kunci API ke domain Anda di https://console.cloud.google.com/apis/credentials → **Browser key** → **Websites** → tambahkan `https://<username>.github.io/*`.

## Versi aplikasi (PWA)
- **Android (Chrome):** buka situs → menu ⋮ → **Instal aplikasi** (atau tombol *Pasang aplikasi* di halaman masuk / Pengaturan).
- **iPhone (Safari):** tombol Bagikan → **Tambah ke Layar Utama**.
- Aplikasi terbuka layar penuh, dengan menu di bawah saat HP tegak, dan tata letak dua kolom saat HP miring.
- Ingin file **APK** untuk Play Store/pemasangan langsung? Masukkan alamat GitHub Pages Anda di https://www.pwabuilder.com → **Package for stores → Android**.

### Merilis versi baru
1. Naikkan `APP_VERSION` di `app.js` dan `VERSION` di `sw.js` (misalnya ke 2.1.1).
2. Unggah ke GitHub. Pengguna yang sedang membuka aplikasi akan melihat tombol **Versi baru tersedia**.

## Laporan Excel & PDF
- Pilih bulan, lalu tekan **Excel** atau **PDF** di kanan atas.
- Di Ringkasan (owner): satu file berisi rekap semua cabang ditambah buku kas tiap cabang (Excel: satu sheet per cabang).
- Di buku kas cabang: laporan cabang itu saja, lengkap dengan saldo awal, saldo berjalan, jumlah, dan kolom tanda tangan.

## Edit & hapus transaksi (owner)
Ketuk transaksi mana pun (di Ringkasan, daftar rincian, atau buku kas cabang) → muncul kwitansi dengan tombol **Edit** dan **Hapus**.
- **Hapus:** ketuk *Hapus*, lalu ketuk *Yakin hapus?* dalam 3 detik.
- **Edit:** ubah jenis, cabang, kategori, nominal, keterangan, tanggal, atau pihak. Jika jenis, cabang, atau bulan berubah, nomor bukti dibuat ulang.
- Setiap edit dan hapus tercatat di **Aktivitas**, lengkap dengan nilai lama → baru.
- Kasir tidak bisa mengedit atau menghapus, termasuk transaksi yang ia catat sendiri (dijaga `firestore.rules`).

## Alamat cabang & kwitansi
Menu **Cabang → Edit** untuk mengubah nama, alamat, dan kota/kabupaten. Kota/kabupaten dipakai di kwitansi dan laporan, misalnya `Pantonlabu, 01-10-2026`.

## Mengganti logo
Owner → **Pengaturan** → pilih gambar. Logo tampil di halaman masuk, bilah atas, dan kwitansi PDF. (Ikon aplikasi di layar HP memakai file di folder `icons/`; ganti file tersebut jika ingin ikonnya ikut berubah.)
