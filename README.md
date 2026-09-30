# Kas Aceh Mandiri Utama

Buku kas multi-cabang. Situs statis untuk GitHub Pages, dengan data dan login di Firebase (Authentication + Firestore). Bisa dipakai dengan paket gratis Firebase (Spark).

## Siapa bisa apa

| | Owner | Kasir cabang |
|---|---|---|
| Lihat ringkasan semua cabang | Ya | Tidak |
| Tambah/nonaktifkan cabang | Ya | Tidak |
| Buat/nonaktifkan akun kasir | Ya | Tidak |
| Catat uang masuk/keluar | Semua cabang | Cabangnya sendiri |
| Lihat buku kas | Semua cabang | Cabangnya sendiri |
| Hapus transaksi | Ya | Tidak |
| Kwitansi PDF + lampiran | Ya | Ya |

Batasan ini dijaga oleh `firestore.rules` di server Firebase, bukan hanya oleh tampilan.

## Langkah pemasangan

### 1. Buat proyek Firebase
1. Buka https://console.firebase.google.com dan buat proyek baru.
2. **Build → Authentication → Get started →** aktifkan **Email/Password**.
3. Di tab **Users**, tekan **Add user** dan buat akun owner (email + password Anda). Lakukan ini lebih dulu, sebelum situs dipublikasikan.
4. **Build → Firestore Database → Create database** (lokasi disarankan `asia-southeast2` Jakarta), mode production.
5. **Project settings → General → Your apps →** tambahkan aplikasi **Web** (ikon `</>`), lalu salin objek `firebaseConfig`.

### 2. Isi konfigurasi
- `firebase-config.js`: tempel `firebaseConfig` dan isi `OWNER_EMAIL` dengan email owner.
- `firestore.rules`: ganti `email-owner@contoh.com` dengan email owner yang sama.

### 3. Pasang aturan keamanan
Di **Firestore Database → Rules**, hapus isinya, tempel isi `firestore.rules`, lalu **Publish**.
(Atau dengan Firebase CLI: `firebase deploy --only firestore:rules`.)

### 4. Publikasikan di GitHub Pages
1. Unggah semua file ini ke repository GitHub (branch `main`, di root).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pilih `main` dan folder `/ (root)`, lalu **Save**.
3. Situs akan aktif di `https://<username>.github.io/<nama-repo>/` dalam 1–2 menit.
4. Di Firebase: **Authentication → Settings → Authorized domains → Add domain**, tambahkan `<username>.github.io`.

### 5. Mulai pakai
1. Buka situs, masuk dengan akun owner.
2. **Kelola cabang →** tambah cabang, lalu **+ Tambah akun kasir** untuk tiap cabang.
3. Berikan email dan password itu ke kasir. Kasir bisa mengganti password lewat **Lupa password?** di halaman masuk.

## Catatan
- `firebaseConfig` memang aman untuk dipublikasikan; yang melindungi data adalah `firestore.rules`.
- Lampiran kwitansi disimpan di Firestore (foto dikecilkan otomatis, PDF maks. 500 KB), jadi tidak perlu Firebase Storage yang kini mewajibkan paket berbayar.
- Akun kasir yang dinonaktifkan langsung kehilangan akses. Menghapus akun sepenuhnya dilakukan di **Authentication → Users**.
- Kuota gratis Firestore: 50.000 baca dan 20.000 tulis per hari; cukup untuk puluhan cabang dengan pemakaian normal.
