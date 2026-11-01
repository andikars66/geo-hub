# GeoHub

**Peta interaktif dan direktori Satuan Lingkungan Setempat (SLS) Kabupaten Lombok Tengah.**

GeoHub membantu pengguna menemukan wilayah, memahami hierarki administratifnya, dan menjelajahi batas pada peta. Pencarian nama atau kode langsung mengarahkan tampilan ke wilayah yang dipilih.

## Fitur

- **Pencarian wilayah** berdasarkan nama atau kode, dengan informasi induk dan opsi pencarian dalam wilayah aktif.
- **Navigasi hierarkis** dari kabupaten, kecamatan, desa/kelurahan, SLS, hingga sub-SLS jika tersedia.
- **Eksplorasi peta** melalui klik wilayah dan breadcrumb. Informasi hover menampilkan nama, kode, hierarki, dan ringkasan wilayah di bawahnya.
- **Peta dasar OpenStreetMap** dengan pilihan kanvas bersih. Tampilan tetap datar dan menghadap utara untuk memudahkan orientasi.
- **Pengaturan batas dan isian** meliputi level wilayah, warna, ketebalan garis, opasitas, dan warna berbeda untuk tiap wilayah.
- **Label adaptif** yang mengikuti ruang tersedia saat zoom dan geser, dengan pengaturan ukuran, warna, ketebalan teks, dan latar.
- **Ekspor PNG** wilayah aktif dengan pratinjau serta pengaturan judul, ukuran, orientasi, warna, label, legenda, skala, dan latar transparan.
- **Antarmuka responsif** untuk desktop dan perangkat seluler, dengan dukungan navigasi keyboard serta tautan wilayah yang dapat dibagikan.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Antarmuka | React, TypeScript, Vite, CSS, Lucide |
| Peta interaktif | MapLibre GL JS, PMTiles, OpenStreetMap |
| Pengolahan geospasial | Python, GeoPandas, Shapely, PyProj, tippecanoe |
| Proyeksi ekspor | Proj4js, EPSG:32750 / UTM zona 50S |
| Pengujian | Vitest, Playwright, axe-core |

GeoHub berjalan sebagai aplikasi web statis. Peta memakai vector tiles agar data batas dapat dimuat sesuai kebutuhan, sedangkan geometri detail digunakan untuk ekspor gambar.

## Data dan atribusi

Batas wilayah bersumber dari `peta_sls_202515202.geojson`. Batas tingkat atas dibentuk melalui agregasi geometri SLS dan bukan penetapan batas administratif resmi. Entri sumber yang ambigu ditandai pada antarmuka.

Peta dasar © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
