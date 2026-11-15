# LaundryPOS

Aplikasi web kasir dan pelacakan operasional laundry. Antarmuka berbahasa Indonesia, responsif untuk meja kasir desktop maupun petugas yang memakai ponsel, dan dapat dipasang sebagai PWA pada browser yang mendukung.

## Fitur

- **Navigasi sesuai alur laundry**: Dashboard, Transaksi Baru, Pesanan, Pelanggan, Laporan, Data Master yang dapat diperluas, dan Pengaturan. Sidebar menetap di desktop; navigasi bawah tersedia di ponsel.
- **Dashboard tindakan**: pesanan siap diambil yang belum lunas, melewati estimasi, dan belum diambil melewati ambang hari.
- **Transaksi multi-layanan**: data pelanggan, keranjang beberapa layanan, pilihan kecepatan dinamis, jumlah per kg/pcs/m², harga snapshot, estimasi otomatis, catatan, dan pembayaran awal.
- **Tracking satu arah**: Diterima → Antrian → Dicuci → Dikeringkan → Disetrika → Dikemas → Siap diambil → Selesai. Tahap produksi yang dilewati mengikuti konfigurasi tiap layanan. Status dapat diurungkan oleh petugas yang sama selama delapan detik.
- **Pembayaran terpisah dari status cucian**: Belum bayar, DP, atau Lunas, dengan riwayat jumlah, metode tunai/transfer/QRIS, waktu, dan petugas.
- **Serah-terima**: wajib verifikasi kode invoice atau nama pengambil. Pesanan yang belum lunas hanya dapat diserahkan jika Pemilik menyetujui secara eksplisit.
- **Invoice cetak**: invoice dapat dicetak sesudah transaksi dibuat dan bukti pengambilan dapat dicetak setelah cucian diserahterimakan.
- **Rak dan nota WhatsApp**: lokasi rak tampil pada pesanan dan nota. Nota berisi daftar layanan, total, pembayaran, sisa tagihan, estimasi, dan pesan siap diambil.
- **Pelanggan**: cari, tambah, dan ubah data berdasarkan nomor telepon; data pelanggan lama dapat terisi saat transaksi baru.
- **Komplain**: catat luntur, hilang, rusak, atau lainnya dan perbarui status penanganan.
- **Laporan dan tutup kas**: rekap harian menurut metode bayar, jumlah pesanan, uang tunai fisik, dan selisih kas per petugas.
- **Data Master Pemilik**: halaman terpisah untuk layanan, pengguna, dan kecepatan laundry. Kecepatan memiliki pengali tarif dan durasi yang dapat ditambah atau diubah.
- **Pengaturan Pemilik**: ambang peringatan cucian belum diambil.
- **Akun dan hak akses**: Pemilik, Kasir, dan Petugas cuci. Sesi memakai cookie HttpOnly; kata sandi di-hash.
- **Sinkronisasi lintas perangkat**: perangkat memakai server dan basis data yang sama. Daftar pesanan diperbarui setiap 30 detik dan saat tab aktif kembali.
- **PWA responsif**: mendukung pemasangan melalui browser; koneksi ke server tetap diperlukan untuk membaca dan menyimpan data.

## Teknologi

- Next.js 16 App Router dan React
- TypeScript, Tailwind CSS v4, dan lucide-react
- Prisma ORM 6 dan MySQL
- Zod untuk validasi request

## Persiapan lokal

Persyaratan: Node.js/npm, MySQL (misalnya Laragon), dan database `laundry_db`.

1. Pasang dependensi:

   ```bash
   npm install
   ```

2. Buat `.env` di root proyek. Sesuaikan kredensial MySQL lokal:

   ```env
   DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/laundry_db"
   ```

3. Terapkan migrasi, buat Prisma Client, dan isi layanan awal:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   npx prisma db seed
   ```

   Migrasi Prisma yang digunakan:

   - `20261115003126_init` — skema awal layanan, pelanggan, dan pesanan.
   - `20261115060000_business_workflows` — tambahan alur kerja, pembayaran, akun, dan data operasional secara aditif.
   - `20261115070000_status_undo_marker` — penanda riwayat untuk membedakan perubahan status yang diurungkan.
   - `20261115092200_laundry_speed_tiers` — master kecepatan dan snapshot nama kecepatan pada item order; data item lama dipetakan ke Reguler/Express.

   Migrasi bersifat aditif dan tidak menghapus order lama: status `PENDING` dipetakan ke `QUEUED`, harga item lama disalin sebagai snapshot, dan order lama yang telah lunas diberi catatan pembayaran historis. Migrasi penanda undo dan kecepatan menambah kolom/tabel dengan nilai bawaan aman. Gunakan `prisma migrate deploy` untuk menerapkan migrasi; jangan gunakan reset database pada data operasional.

4. Untuk membuat akun Pemilik pertama kali, tambahkan ke `.env`:

   ```env
   OWNER_NAME="Pemilik"
   OWNER_EMAIL="pemilik@example.com"
   OWNER_PASSWORD="kata-sandi-minimal-12-karakter"
   ```

   Jalankan `npx prisma db seed` kembali. Akun dengan email yang sudah ada tidak ditimpa. Simpan `.env` secara privat dan jangan masukkan kredensial ke Git.

5. Jalankan aplikasi:

   ```bash
   npm run dev
   ```

   Buka [http://localhost:3000](http://localhost:3000) dan masuk memakai akun Pemilik.

### Akses melalui ponsel

Jalankan server di jaringan lokal:

```bash
npm run dev -- --hostname 0.0.0.0
```

Sambungkan ponsel ke Wi-Fi yang sama dan buka `http://ALAMAT-IP-KOMPUTER:3000`. Izinkan akses pada Windows Firewall jika diminta. Untuk PWA di deployment publik gunakan HTTPS. PWA tidak menyediakan penyimpanan offline atau sinkronisasi saat terputus dari server.

## Rute utama

| Rute | Kegunaan |
| --- | --- |
| `/` | Dashboard tindakan dan ringkasan |
| `/orders/new` | Transaksi baru |
| `/orders` | Daftar, pencarian, serta filter pesanan |
| `/orders/[id]` | Detail, timeline, pembayaran, komplain, serah-terima, dan cetak invoice/bukti pengambilan |
| `/customers` | Data pelanggan |
| `/reports` | Laporan harian dan tutup kas |
| `/master-data/services` | Master layanan (Pemilik) |
| `/master-data/users` | Master pengguna dan peran (Pemilik) |
| `/master-data/speeds` | Master kecepatan laundry (Pemilik) |
| `/settings` | Ambang cucian belum diambil (Pemilik) |
| `/login` | Masuk |

## API inti

| Method | Endpoint | Kegunaan |
| --- | --- | --- |
| `GET`, `POST` | `/api/orders` | Daftar pesanan dan transaksi baru |
| `GET`, `PATCH` | `/api/orders/[id]` | Detail, transisi status, pembayaran, dan urungkan status |
| `GET`, `POST`, `PATCH` | `/api/services` dan `/api/services/[id]` | Master layanan |
| `GET`, `POST`, `PATCH` | `/api/speeds` dan `/api/speeds/[id]` | Master kecepatan laundry |
| `GET`, `POST`, `PATCH` | `/api/customers` dan `/api/customers/[id]` | Data pelanggan |
| `GET`, `POST`, `PATCH` | `/api/staff` dan `/api/staff/[id]` | Akun dan peran (Pemilik) |
| `GET`, `PATCH` | `/api/settings` | Ambang cucian belum diambil |
| `GET` | `/api/reports/daily`, `/api/reports/dashboard` | Laporan dan tindakan dashboard |
| `GET`, `POST` | `/api/cash-closures` | Rekap dan tutup kas harian |

## Validasi

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Kecepatan dikonfigurasi sebagai pengali terhadap tarif dasar dan durasi dasar layanan; nilai tarif serta durasi aktual disimpan sebagai snapshot pada order. Nilai awal Express adalah pengali tarif 1,5 dan pengali durasi 0,5. Tes domain mencakup transisi status, kalkulasi keranjang multi-item/kecepatan, serah-terima, dan aturan waktu urungkan status.

## Batasan

Aplikasi memerlukan koneksi jaringan ke server dan basis data yang sama. Belum mencakup mode offline, push notification, atau antar-jemput.
