# Cashflow Management AMU · v4.0.0

Buku kas multi-cabang untuk PT Aceh Mandiri Utama. Situs statis di GitHub Pages, data dan login di Firebase (Authentication + Firestore). Cukup dengan paket gratis Firebase (Spark). Bisa dipasang di HP sebagai aplikasi (PWA).

## Siapa bisa apa

| | Owner | Kasir cabang |
|---|---|---|
| Ringkasan & insight semua cabang | Ya | Cabangnya sendiri |
| Tambah cabang + buat login kasir | Ya | Tidak |
| Kelola kategori (tambah/hapus) | Ya | Hanya memilih |
| Catat uang masuk/keluar | Semua cabang, tanggal bebas | Cabangnya sendiri, tanggal hari ini atau kemarin |
| Edit & hapus transaksi (termasuk yang dicatat kasir) | Ya | Tidak |
| Kwitansi PDF | Ya | Ya |
| Edit nama/alamat cabang (wajib password owner) | Ya | Tidak |
| Edit nama/username login kasir (wajib password owner) | Ya | Tidak |
| Unduh laporan Excel & PDF | Rekap semua cabang + per cabang | Cabangnya sendiri |
| Ubah password sendiri | Ya | Ya |
| Log aktivitas | Melihat semua | Tercatat otomatis |
| Cari transaksi | Semua cabang | Cabangnya sendiri |
| Backup data (Excel / Google Drive) | Ya | Tidak |

Batasan ini dijaga oleh `firestore.rules` di server Firebase, termasuk: kasir hanya bisa memakai kategori yang ditetapkan owner.

## Pemasangan

### 1. Firebase (proyek `cashflow-amu`)
1. **Authentication → Sign-in method →** aktifkan **Email/Password**.
2. **Authentication → Users → Add user**: buat akun owner `cashflow.amu@gmail.com`.
3. **Firestore Database → Create database** (lokasi `asia-southeast2` Jakarta), mode production.
4. **Firestore Database → Rules**: tempel isi `firestore.rules`, lalu **Publish**. Ulangi setiap kali file ini berubah.

`firebase-config.js` sudah terisi untuk proyek ini. Jika email owner diganti, ubah juga di `firestore.rules`.

### 1b. Indeks Firestore (wajib sejak v4)
Firestore → **Indexes** → **Composite** → **Create index**:
- Collection ID: `tx`
- Field 1: `branchId` · Ascending
- Field 2: `date` · Ascending
- Query scope: Collection

Tunggu sampai statusnya *Enabled* (beberapa menit). Tanpa indeks ini, kasir akan melihat pesan "Database belum siap".

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

## Menu
- **Kasir:** Input · Buku kas · Ringkasan. Aplikasi langsung terbuka di tab **Input** supaya mencatat lebih cepat.
- **Owner:** Ringkasan · Input · Analisis · Cabang · Kategori · Aktivitas. Akun, ubah password, dan pasang aplikasi ada di tombol bulat di kanan atas.

## Analisis (owner)
Filter jenis (pengeluaran/pemasukan), periode (bulan ini, bulan lalu, 3 bulan, tahun ini, semua), cabang, dan kategori. Isinya: peringkat cabang dan kategori (terbanyak/tersedikit), tabel kategori × cabang, dan keterangan dengan nominal terbesar. Semua angka bisa diketuk untuk melihat daftar transaksi dan kwitansinya.

## Watermark kwitansi
Kwitansi (layar dan PDF) diberi watermark logo samar di tengah, dibuat otomatis dari `logo.jpg` (latar dongker dihilangkan).

## Edit login kasir
Menu **Cabang** → di bawah nama kasir tekan **Edit**.
- **Ganti nama saja:** login tetap sama.
- **Ganti username:** isi password baru untuk kasir. Login baru dibuat dan login lama langsung nonaktif (kasir yang sedang masuk akan keluar otomatis). Username lama tidak bisa dipakai lagi.
- **Kasir lupa password:** ganti username-nya (mis. tambahkan angka) dan isi password baru.
- Setiap perubahan wajib dikonfirmasi dengan password owner dan tercatat di Aktivitas.

## Mengganti logo
Logo diambil dari file **`logo.jpg`** di repo (persegi, mis. 640×640). Ganti file itu di GitHub untuk mengubah logo di halaman masuk, bilah atas, kwitansi, dan laporan PDF. Ikon aplikasi di layar HP ada di folder **`icons/`** (icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png); ganti juga jika ingin ikonnya ikut berubah. Setelah mengganti, naikkan versi di `sw.js` agar HP yang sudah memasang aplikasi ikut memperbarui.

## Pembaruan ke v4 (penting)
1. Tempel isi `firestore.rules` yang baru di **Firestore → Rules → Publish**.
2. Buat indeks Firestore (bagian 1b di atas).
3. Upload semua file ke GitHub.
4. Masuk sebagai **owner** lebih dulu. Saat pertama kali, aplikasi otomatis menghitung ringkasan saldo dari semua transaksi lama (sekali saja).

## Aturan tanggal kasir
Kasir hanya bisa memilih tanggal **hari ini atau kemarin** (WIB). Dijaga di aplikasi dan di server. Owner bebas memilih tanggal kapan pun.

## Nomor bukti
Nomor bukti (mis. `KK/BAN/202610/001`) diambil dari penghitung di server per cabang, jenis, dan bulan, di dalam satu transaksi database. Dua kasir yang menyimpan bersamaan tidak akan mendapat nomor yang sama.

## Kecepatan & saldo
- Aplikasi hanya memuat transaksi **3 bulan terakhir**. Bulan yang lebih lama dimuat otomatis saat dipilih, atau lewat tombol *Muat semua data* di kolom pencarian.
- Saldo dihitung dari **ringkasan bulanan** yang ikut diperbarui setiap transaksi dicatat, diedit, atau dihapus. Jadi saldo tetap benar tanpa memuat semua transaksi.
- Jika saldo terasa tidak cocok: owner → tombol akun → **Hitung ulang saldo**.

## Simpan saat offline
Jika sinyal hilang saat menyimpan, transaksi disimpan di HP dan muncul bilah kuning *Offline*. Transaksi dikirim otomatis begitu online, dan nomor bukti dibuat saat terkirim. Catatan: antrean kasir dari kemarin yang baru terkirim lusa akan ditolak karena melewati batas tanggal; owner perlu mencatatnya.

## Pencarian
Kolom **Cari transaksi** di Ringkasan (owner), buku kas cabang, dan tab Buku kas (kasir). Bisa mencari keterangan, nomor bukti, kategori, pihak, nama cabang, atau nominal (mis. `450.000`).

## Backup
Owner → tombol akun (kanan atas) → **Backup data**. Isinya satu file Excel: semua transaksi, cabang, login kasir, kategori, dan saldo bulanan. Ringkasan akan mengingatkan jika backup terakhir lebih dari 7 hari.
- **Unduh backup (Excel):** langsung tersimpan di perangkat.
- **Simpan ke Google Drive:** file masuk ke folder *Backup Cashflow AMU* di Drive akun Google yang dipilih. Perlu diatur sekali:
  1. https://console.cloud.google.com → pilih proyek `cashflow-amu` → **APIs & Services → Library** → aktifkan **Google Drive API**.
  2. **Google Auth Platform / OAuth consent screen**: isi nama aplikasi dan email, Audience **External**, tambahkan `cashflow.amu@gmail.com` (atau akun Google tujuan backup) sebagai **Test user**.
  3. **Credentials → Create credentials → OAuth client ID** → jenis **Web application** → *Authorized JavaScript origins*: alamat situs Anda, mis. `https://cma.web.id` (dan `https://USERNAME.github.io` jika dipakai).
  4. Salin **Client ID** ke `GOOGLE_CLIENT_ID` di `firebase-config.js`, lalu upload ke GitHub.
  Client ID bukan rahasia, aman berada di GitHub. Izin yang diminta hanya `drive.file` (aplikasi hanya bisa melihat file yang dibuatnya sendiri).
- Backup otomatis terjadwal tanpa membuka aplikasi memerlukan server (Cloud Functions, paket Blaze), jadi tidak termasuk.
