# Menyambungkan Pantul ke Firebase (akun & online sungguhan)

Tanpa langkah ini, Pantul berjalan dengan **MockBackend**: akun, market, dan room "Main dengan Teman"
hanya tersambung antar tab/window di **browser yang sama** — berguna untuk mencoba alurnya, tapi tidak
untuk pemain sungguhan di perangkat berbeda. Mengikuti panduan ini mengaktifkan **FirebaseBackend**
(di `src/19-firebase-backend.js`) yang punya bentuk API identik, jadi tidak ada kode UI yang perlu diubah.

## 1. Buat project Firebase

1. Buka https://console.firebase.google.com → **Add project** → ikuti wizard (gratis, paket Spark cukup).
2. Di project itu, buka **Build → Authentication → Get started**. Di tab **Sign-in method**, aktifkan:
   - **Email/Password**
   - **Google**
3. Buka **Build → Firestore Database → Create database** → mode **Production**, pilih lokasi terdekat.
4. Buka **Build → Storage → Get started** (untuk foto avatar).
5. Buka **Project settings** (ikon gerigi) → tab **General** → scroll ke "Your apps" → klik ikon `</>` (Web) →
   daftarkan app → salin objek `firebaseConfig` yang muncul (6 nilai: `apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`).
6. Buka **Authentication → Settings → Authorized domains** → tambahkan domain tempat game ini akan
   dihosting (misalnya `namauser.github.io`), supaya Sign in with Google tidak ditolak browser.

## 2. Pasang aturan keamanan Firestore (WAJIB sebelum dipakai publik)

Di **Firestore Database → Rules**, ganti isinya dengan:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() { return isSignedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'; }

    match /users/{uid} {
      allow read: if isSignedIn();
      // role BARU wajib 'user' — tidak bisa klaim admin sendiri saat daftar.
      allow create: if isSignedIn() && request.auth.uid == uid && request.resource.data.role == 'user';
      // role tidak boleh diubah lewat client sama sekali (hanya lewat Firestore Console).
      allow update: if isSignedIn() && request.auth.uid == uid && request.resource.data.role == resource.data.role;
    }
    match /market/{id} {
      allow read: if true;
      allow create, delete: if isAdmin();
    }
    match /rooms/{code} { allow read, write: if isSignedIn(); }
    match /queue/{uid} { allow read, write: if isSignedIn(); }
    match /matches/{uid} { allow read, write: if isSignedIn(); }
  }
}
```

**Kenapa ini penting:** tanpa aturan `role` di atas, pengguna mana pun bisa menulis `role: "admin"` ke
dokumen akunnya sendiri lewat DevTools dan membuka halaman Developer. Aturan ini mengunci field `role`
sepenuhnya dari client — hanya bisa diubah manual oleh Anda di Firestore Console (langkah 4).

Di **Storage → Rules**, pakai:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{uid}.jpg { allow read: if true; allow write: if request.auth != null && request.auth.uid == uid; }
  }
}
```

## 3. Isi config ke proyek

Edit `src/firebase-config.json`, ganti isinya (yang semula `null`) dengan objek `firebaseConfig` dari
langkah 1.5, contoh:

```json
{ "apiKey": "AIza...", "authDomain": "xxx.firebaseapp.com", "projectId": "xxx", "storageBucket": "xxx.appspot.com", "messagingSenderId": "123", "appId": "1:123:web:abc" }
```

Lalu build ulang:
```
python3 tools/build.py
```
`tools/build.py` otomatis menambahkan tag `<script>` SDK Firebase ke `www/index.html` dan menyuntikkan
config ke `FIREBASE_CONFIG`, **hanya jika** file ini berisi objek (bukan `null`). `src/16-main.js` memilih
`FirebaseBackend` dibanding `MockBackend` secara otomatis berdasarkan hal ini — tidak ada kode lain yang
perlu diubah.

## 4. Jadikan akun Anda admin

1. Jalankan game, **Daftar** dengan akun Anda sekali (lewat email/password atau Google).
2. Di Firebase Console → **Firestore Database → Data**, buka koleksi `users`, cari dokumen dengan email
   Anda, lalu ubah field `role` dari `"user"` menjadi `"admin"` secara manual.
3. Muat ulang game. Tile **Developer** akan muncul di menu untuk akun Anda saja.

## 5. (Opsional) Batasi siapa yang bisa daftar

Paket Spark Firebase cukup untuk puluhan–ratusan pemain aktif. Jika perlu membatasi pendaftaran, matikan
toggle "Enable" di provider **Email/Password** / **Google** pada Authentication → Sign-in method kapan saja
untuk menjeda pendaftaran baru sementara (akun lama tetap bisa masuk).

## Keterbatasan yang masih ada setelah langkah ini

- **Sinkronisasi tembakan** memakai dokumen Firestore sebagai papan pesan (`onSnapshot`), cocok untuk
  game giliran seperti biliar. Ini **bukan** koneksi peer-to-peer tersembunyi — kedua pemain menulis ke
  dokumen room yang sama, jadi perlu koneksi internet masing-masing ke Firestore, bukan ke satu sama lain.
- **Taruhan koin di mode Online/Main dengan Teman belum ada** (ditiadakan secara sengaja): memotong koin
  satu pemain dan memberi ke pemain lain lewat client biasa bisa dicurangi tanpa server tepercaya (Cloud
  Function). Koin dari mode lawan bot/lokal tetap aman karena tidak melibatkan pemain lain.
- **Validasi tembakan** (`ShotValidator`) hanya dijalankan di sisi pengirim sebelum broadcast; penerima
  memercayai hasilnya. Cukup untuk bermain santai dengan teman, tapi bukan anti-cheat penuh.
