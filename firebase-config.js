// Ganti isi objek ini dengan konfigurasi dari Firebase Console:
// Project settings → General → Your apps → Web app → SDK setup and configuration → Config
export const firebaseConfig = {
  apiKey: "ISI_API_KEY",
  authDomain: "ISI_PROJECT_ID.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  storageBucket: "ISI_PROJECT_ID.appspot.com",
  messagingSenderId: "ISI_SENDER_ID",
  appId: "ISI_APP_ID"
};

// Email akun owner. Harus sama persis dengan OWNER_EMAIL di firestore.rules.
export const OWNER_EMAIL = "email-owner@contoh.com";
