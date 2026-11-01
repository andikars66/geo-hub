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

Untuk hosting statis, build dengan `npm ci && npm run build` lalu sajikan `dist`. Hash routing tidak memerlukan rewrite URL. Pastikan hosting mendukung HTTP Range 206 untuk PMTiles, MIME yang benar, dan konfigurasi cache pada `_headers`. Verifikasi kuota penyedia saat deployment. Tidak membutuhkan backend aplikasi, secret, atau database.

OpenStreetMap memakai endpoint resmi tanpa prefetch/offline tile. Patuhi kebijakan penyedia. Browser test mensimulasikan kegagalan OSM untuk memverifikasi batas lokal tetap berfungsi; pengujian lokal tidak membuktikan konektivitas pada semua jaringan atau kesiapan hosting publik.

Baca PRD.md untuk cakupan produk, DESIGN.md untuk rancangan, dan AGENTS.md untuk aturan kontribusi.
