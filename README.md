# GeoHub

Peta interaktif dan direktori SLS Kabupaten Lombok Tengah. React + TypeScript + Vite, MapLibre, PMTiles. Seluruh fungsi berjalan di browser tanpa backend atau API berbayar.

## Menjalankan aplikasi

Node **24.19.0** direkomendasikan. Aset turunan data sudah disertakan; Python dan tippecanoe tidak dibutuhkan untuk sekadar menjalankan website.

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Tes browser memakai Chromium yang terpasang di `/usr/bin/chromium`. Untuk instalasi lain tentukan `CHROMIUM_PATH` ke executable Chromium/Chrome. Playwright menyalakan dev server sendiri.

```sh
npm run test:e2e
```

## Membangun ulang data

Sumber GeoJSON/QGIS di root tidak diubah. Gunakan Python **3.12**, compiler C++ dan tippecanoe **2.79.0**. Instal tippecanoe dari tag resmi `felt/tippecanoe` (commit `68ab8dcc229f95b8b25877697d5e8d66783af503`); pada Linux dibutuhkan development headers SQLite dan zlib. Build standar: `make -j4`, kemudian arahkan `TIPPECANOE` ke binary hasil build.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/data/requirements.txt
TIPPECANOE=/path/to/tippecanoe .venv/bin/python scripts/data/build.py
```

Pipeline memeriksa CRS, geometri, keunikan fitur, parentage, nama konflik, dan kesetaraan union anak/induk. Anomali sumber yang dikenal dipertahankan dengan penanda. Output berversi checksum ada di `public/data`; laporan ada di `data/reports`. Pipeline memerlukan waktu lebih lama dari build UI. Data mentah sekitar 23 MB tidak disajikan sebagai payload awal aplikasi.

## Fitur

- Direktori kabupaten → kecamatan → desa → SLS → sub-SLS opsional.
- Pencarian nama/kode, konteks induk, dan filter subtree.
- Peta vector tiles, outline aktif, default batas anak, override level, label, dan transparansi.
- Pilihan multi-wilayah pada level sama, dipertahankan lintas konteks.
- Ekspor PNG geometri detail dalam EPSG:32750: warna, ketebalan, label/kode, batas anak, judul, latar, ukuran, orientasi, legenda, skala dan utara grid. Pratinjau harus diperbarui setelah pengaturan berubah.
- URL hash, Back/Forward, layout mobile, dialog native, dan kontrol keyboard.

## Hosting statis

Untuk Cloudflare Pages: build command `npm ci && npm run build`, output `dist`, Node 24.19.0. Tidak perlu functions, secret, atau database. Hash routing tidak memerlukan rewrite SPA. `_headers` mengatur cache aset versi dan manifest.

Sebelum publikasi periksa kuota/batas file paket gratis terbaru, dukungan byte-range **206**, tile nyata, deep link, serta ukuran transfer terkompresi. PMTiles saat ini sekitar 4 MB, di bawah batas 25 MiB per aset Pages yang harus diverifikasi kembali saat deploy. Pengujian range saat pengembangan tidak membuktikan hosting publik sudah teruji. Tidak ada deployment publik yang dilakukan dalam implementasi ini.

## Batasan yang disengaja

Basemap saat ini kanvas bersih. Google Maps resmi dan layanan tile jalan belum diintegrasikan; tidak ada endpoint Google tidak resmi. Ekspor tanpa basemap tetap berfungsi penuh. Label peta dibatasi untuk menghindari daftar besar; label ekspor memakai deteksi benturan. Font menggunakan stack sistem tanpa request eksternal. Tanggal pemutakhiran dan status resmi batas tidak disimpulkan dari nama berkas.

Lihat [PRD.md](PRD.md), [DESIGN.md](DESIGN.md), dan [AGENTS.md](AGENTS.md) untuk kontrak produk, anomali sumber, dan aturan kontribusi.

## Validasi implementasi v0.1

- Build produksi dan TypeScript lulus.
- 7 unit test terhadap indeks data nyata lulus.
- 3 browser test di Chromium lulus: navigasi/histori/peta/ekspor/mobile; URL tak dikenal, pencarian subtree, storage ditolak dan batas canvas; audit axe WCAG A/AA halaman utama dan dialog layer.
- Tile benar-benar dirender dan respons PMTiles lokal menggunakan Range 206. PNG diunduh dan header/dimensi 1600 × 1000 diperiksa; hasil gambar diperiksa secara visual.
- Arsip PMTiles sekitar 4 MB; indeks sekitar 3,95 MB mentah / 460 KB gzip. Shell JS sekitar 67 KB gzip, engine peta sekitar 283 KB gzip terpisah, modul ekspor sekitar 45 KB gzip saat dibuka. Total startup juga mencakup data dan CSS. Vite masih memberi peringatan chunk engine >500 KB mentah.
- Sumber GeoJSON/QGIS tidak berubah. Seluruh aset individual berada di bawah 25 MiB; dukungan hosting publik tetap perlu diperiksa saat deployment.

Tes produksi lokal dapat diulang setelah build:

```sh
TEST_PRODUCTION=1 npm run test:e2e
```

Audit otomatis ini bukan sertifikasi aksesibilitas penuh atau profil performa perangkat mobile fisik. Google Maps, provider basemap jalan, dan publikasi hosting belum dilakukan.
