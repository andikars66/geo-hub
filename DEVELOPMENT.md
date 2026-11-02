# Pengembangan GeoHub

## Aplikasi

Node 24.19.0 direkomendasikan. Aset data sudah tersedia dalam repository.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

Browser test memakai Chromium di `/usr/bin/chromium`. Gunakan `CHROMIUM_PATH` untuk executable lain. Playwright menyalakan server sendiri.

```sh
npm run test:e2e
# Jalankan setelah build untuk menguji output produksi:
npm run test:e2e:production
```

## Pipeline data

Gunakan Python 3.12 dan tippecanoe 2.79.0 dari `felt/tippecanoe`, commit `68ab8dcc229f95b8b25877697d5e8d66783af503`. Kompilasi tippecanoe membutuhkan compiler C++, SQLite dan zlib development headers; jalankan `make -j4` pada checkout tool.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/data/requirements.txt
TIPPECANOE=/path/to/tippecanoe .venv/bin/python scripts/data/build.py
```

Pipeline menjaga sumber asli, memvalidasi geometri/relasi, dan menghasilkan aset berversi di `public/data` serta audit di `data/reports`. Detail kontrak data dan penanganan anomali ada di DESIGN.md.

## Hosting

Untuk hosting statis, build dengan `npm ci && npm run build` lalu sajikan `dist`. Hash routing tidak memerlukan rewrite URL. Utamakan hosting dengan HTTP Range 206 untuk PMTiles, MIME yang benar, dan konfigurasi cache penyedia. Verifikasi kuota penyedia saat deployment. Tidak membutuhkan backend aplikasi, secret, atau database.

OpenStreetMap memakai endpoint resmi tanpa prefetch/offline tile. Patuhi kebijakan penyedia. Browser test mensimulasikan kegagalan OSM untuk memverifikasi batas lokal tetap berfungsi; pengujian lokal tidak membuktikan konektivitas pada semua jaringan atau kesiapan hosting publik.

Baca PRD.md untuk cakupan produk, DESIGN.md untuk rancangan, dan AGENTS.md untuk aturan kontribusi.

## Diagnosis pemuatan peta

Vercel memakai `vercel.json` untuk header; `public/_headers` berlaku untuk penyedia yang mendukung format tersebut. Manifest harus direvalidasi, sementara aset dengan versi checksum dapat di-cache immutable. PMTiles disajikan sebagai binary tanpa rewrite ke HTML; request Range idealnya mendapatkan respons 206. Konfigurasi header tidak dengan sendirinya membuktikan dukungan Range pada deployment.

Pesan pemuatan dipisah antara OSM, batas PMTiles, outline wilayah, dan error tampilan. Console browser mencatat diagnostik dengan awalan `[GeoStamp map]` atau `[GeoStamp outline]`. Request outline dibatalkan ketika konteks berubah. Retry membuat pembaca PMTiles baru agar kegagalan header yang tersimpan dalam cache tidak mengunci pemuatan selanjutnya. Peringatan sumber/tile dihapus setelah event keberhasilan yang sesuai; mematikan OSM tidak menghapus error batas.

Tes browser mensimulasikan PMTiles HTTP 503, pemulihan dengan retry, serta request outline wilayah lama yang gagal setelah navigasi. Hasil tersebut bukan bukti akar masalah jaringan pada deployment tertentu.

Kegagalan transport sementara PMTiles (network fetch, HTTP 408/429/5xx) dicoba ulang maksimum dua kali dengan jeda 200 ms dan 600 ms. Source memvalidasi Content-Range, panjang respons, dan ETag; file hilang, ketidaksesuaian Range, dan error parsing tidak disamarkan sebagai sukses. Backoff dibatalkan saat sinyal request dibatalkan oleh navigasi/zoom. Tombol tutup alert membisukan insiden sumber yang sama sampai sumber pulih atau pengguna memulai retry baru; detail diagnostik tetap tercatat di console.


## Fallback untuk hosting tanpa byte serving

Error PMTiles `Server returned no content-length header or content-length exceeding request` terjadi saat request Range menerima HTTP 200 yang tidak dapat diperlakukan sebagai potongan byte. Ini dapat berasal dari server, CDN, atau cache; pesan itu tidak menentukan komponen mana yang mengubah respons.

Source kini tetap memakai 206 pada jalur normal. Jika menerima 200, body request tersebut dibatalkan, lalu dilakukan satu GET penuh tanpa header Range. Semua tile berbagi snapshot arsip dalam memori; zoom dan perubahan konteks memakai byte slice lokal tanpa mengunduh ulang arsip. Arsip saat ini sekitar 4,14 MB. Fallback dibatasi 32 MiB dan 30 detik, memeriksa signature PMTiles dan ETag, serta menolak respons HTML. Pembatalan satu tile tidak membatalkan unduhan bersama; pembongkaran map membatalkannya. Retry manual membuat pembaca baru.

Tes mencakup respons 200 dengan/tanpa Content-Length, pemakaian unduhan bersama, ETag berubah, pembatalan, batas ukuran/timeout, dan rendering poligon nyata saat seluruh request Range diabaikan. Pengujian ini mereproduksi jenis respons yang dilaporkan pengguna; tidak menetapkan bahwa konfigurasi origin Vercel adalah satu-satunya penyebabnya.
