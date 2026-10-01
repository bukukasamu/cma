// Konfigurasi Firebase untuk proyek cashflow-amu.
// Aman dipublikasikan: nilai ini hanya menunjuk ke proyek, bukan kunci rahasia.
// Data dilindungi oleh firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyAQoyF1IvU9BCyINiuI-EY778oHN54FPz4",
  authDomain: "cashflow-amu.firebaseapp.com",
  projectId: "cashflow-amu",
  storageBucket: "cashflow-amu.firebasestorage.app",
  messagingSenderId: "618480455302",
  appId: "1:618480455302:web:0be49faed1464cffd48b07"
};

// Email akun owner. Harus sama persis dengan email di firestore.rules.
export const OWNER_EMAIL = "cashflow.amu@gmail.com";

// (Opsional) Untuk tombol "Simpan ke Google Drive" di menu Akun owner.
// Isi dengan OAuth Client ID (jenis "Web application") dari Google Cloud Console. Lihat README bagian Backup.
// Client ID bukan rahasia dan aman berada di GitHub. Biarkan kosong jika belum dipakai.
export const GOOGLE_CLIENT_ID = "";
