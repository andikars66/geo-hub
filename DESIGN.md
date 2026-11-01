# GeoHub — Rancangan Teknis dan Antarmuka

> Keputusan redesign terbaru: fokus utama adalah mencari dan melihat hierarki wilayah. Peta layar penuh tanpa sidebar kiri; pencarian di tengah atas dengan hasil langsung di bawahnya dan tombol reset. Klik hasil atau poligon membuka wilayah; hover menampilkan nama, kode, jalur dan ringkasan anak. OpenStreetMap menjadi basemap default (atribusi wajib), dengan opsi kanvas kosong. Pengaturan mencakup level batas, label, transparansi, warna tunggal atau warna berbeda per wilayah. Ekspor adalah aksi sekunder pada kartu wilayah aktif; pemilihan banyak wilayah melalui direktori tidak lagi menjadi alur utama versi ini. Ketentuan ini menggantikan layout dan prioritas ekspor versi awal di bawah. Kartu konteks desktop ringkas berada di kiri atas di bawah logo; breadcrumb hanya memuat induk dan unduhan berupa ikon sekunder. Label tidak dibatasi jumlah wilayah: tampil sesuai ruang layar dan benturan teks, diperbarui saat zoom/pan/resize; informasi hover mengikuti pointer dekat poligon, dengan highlight halus. Garis batas anak default 2 px dengan warna independen dari isian. Pengguna dapat mengatur ukuran, warna, tebal dan latar label. Dialog memakai satu area scroll isi dan dapat ditutup dengan klik di luar, Escape atau tombol tutup; interaksi di dalam tidak menutup dialog.


Status: kontrak rancangan MVP dengan implementasi v0.1. Lihat catatan implementasi di akhir untuk perbedaan dan batasan aktual. Persyaratan produk ada di PRD.md.

## Arsitektur

```text
GeoJSON asli + metadata QGIS + override terverifikasi (opsional)
        ↓ pipeline Python: audit → normalisasi turunan → hierarki → agregasi
        ├── manifest + laporan kualitas
        ├── indeks direktori dan pencarian
        ├── geometri detail per wilayah/cakupan untuk ekspor
        └── vector tiles PMTiles untuk tampilan
                         ↓
             React / TypeScript / Vite
             MapLibre GL JS + pembaca PMTiles
                         ↓
               hosting statis + CDN
```

Tidak ada backend runtime. Python diperlukan saat pengolahan/build data, bukan di browser. React menangani UI/state; MapLibre menangani rendering spasial. Kode mesin peta dan ekspor di-load terpisah bila memungkinkan. Gunakan CSS biasa dengan token desain; hindari menambah UI framework besar tanpa kebutuhan.

## Struktur proyek yang dituju

Struktur ini adalah target, bukan klaim bahwa file sudah tersedia:

```text
PRD.md / DESIGN.md / AGENTS.md
peta_sls_202515202.geojson          # sumber immutable
peta_sls_20260202.qmd              # sumber metadata
scripts/data/                     # pipeline dan validasi
data/overrides/                    # hanya koreksi terverifikasi
data/reports/                      # hasil audit deterministik
public/data/                      # aset browser hasil pipeline
src/app/                          # shell, routing/state URL
src/features/directory/
src/features/search/
src/features/map/
src/features/layers/
src/features/export/
src/components/                   # kontrol bersama yang aksesibel
src/styles/                       # token dan layout
tests/                            # tes perilaku dan integrasi
```

Kunci versi dependency dengan lockfile. Tentukan serta pin versi Node dan tool pembuat tiles ketika implementasi dimulai. Lingkungan saat perencanaan sudah memiliki Python 3.12 dan GeoPandas; virtualenv di luar checkout bukan dependency proyek yang boleh diasumsikan tersedia di CI.

## Kontrak data

```ts
type RegionLevel = 'kabupaten' | 'kecamatan' | 'desa' | 'sls' | 'subsls';
type Region = {
  id: string;                     // ID internal stabil dan namespaced
  sourceCode: string;             // kode sumber, tidak dikonversi ke number
  level: RegionLevel;
  name: string;
  parentId: string | null;
  childIds: string[];
  bbox: [number, number, number, number]; // lon/lat: west,south,east,north
  geometryRef: string;
  sourceFeatureIds: string[];
  qualityFlags: string[];
};
```

- ID internal mengandung level dan identitas sumber; label, urutan input, serta nama tidak menjadi identitas.
- Induk kecamatan berasal dari gabungan kode provinsi/kabupaten/kecamatan. Relasi desa/SLS diperiksa terhadap field kode dan ID sumber; ketidaksesuaian dilaporkan, bukan diperbaiki dengan pemotongan string sembarang.
- `idsubsls` unik pada sumber saat ini dan dapat menjadi referensi fitur. Jangan menggunakan `fid`, yang memiliki duplikasi.
- Untuk `idsls` ambigu yang sudah diketahui, buat node grup SLS berstatus `ambiguous-source-id`, simpan kedua nama dan referensi fitur, serta tampilkan detail varian sumber. Jangan membuat dua SLS administratif baru atau anak sub-SLS `00`. Nama grup netral: `SLS <kode> — nama ambigu`.
- ID desa 11 digit `52020300016` tetap menjadi node sumber bertanda `nonstandard-source-code`. Jangan otomatis menyatukan dengan desa bernama sama. UI menjelaskan bahwa hitungan berdasarkan kelompok sumber mencakup entri bermasalah.
- Semua anomali diketahui dicatat dalam registry pengecualian teruji; anomali baru yang merusak identitas/parentage menghentikan pipeline dengan laporan yang berguna. Tidak silently overwrite map entries.
- Normalisasi huruf/spasi untuk pencarian tidak mengganti nilai nama asli. Nama lokal ditampilkan dengan kapitalisasi yang terbaca tanpa kehilangan nilai sumber pada detail.
- Buang `path` dan metadata internal yang tidak diperlukan dari aset publik. Simpan checksum sumber dan versi skema dalam manifest. Jangan menyimpulkan tahun data dari nama file.

## Pipeline geospasial

1. Baca sumber sebagai EPSG:4326 dan cocokkan metadata. Audit jumlah, schema, nilai kosong, keunikan ID, geometri, dan relasi parent-child.
2. Bentuk node dan laporan kualitas; sertakan semua fitur dalam lineage. Override hanya diterapkan jika memiliki rujukan dan aturan eksplisit; sumber asli tidak diubah.
3. Agregasikan geometri berdasarkan node dan relasi yang sudah diaudit. Union tidak boleh menelan fitur tanpa jejak. Agregasi grup ambigu diberi flag, bukan diperlakukan sebagai koreksi resmi.
4. Periksa union anak terhadap geometri induk, validitas hasil, dan overlap/celah. Catat toleransi numerik dan statistik; jangan menghilangkan pulau atau poligon kecil hanya untuk lolos pemeriksaan.
5. Buat geometri tampilan dengan simplifikasi yang menjaga shared boundaries. Simplifikasi tiap poligon secara independen tidak cukup. Uji celah baru dan konsistensi antarlevel.
6. Buat PMTiles dengan layer per level dan ID fitur stabil; uji encoding ID string atau pemetaan feature ID numerik jika diperlukan oleh format tiles. Pin tool, opsi zoom, dan toleransi dalam pipeline.
7. Buat geometri detail ekspor per kecamatan/cakupan dan indeks referensinya. Browser memuat hanya cakupan pilihan, lalu menyaring ID yang diperlukan.
8. Tulis manifest aset, checksum, laporan kualitas, dan indeks pencarian secara deterministik; perubahan urutan input tidak mengubah identitas.

Satuan jarak/luas bukan derajat. Gunakan proyeksi metrik lokal EPSG:32750 untuk perhitungan yang sesuai dengan lokasi Lombok Tengah. Verifikasi unit, round-trip CRS, dan kesetaraan geometri, termasuk MultiPolygon dan lubang.

## Data delivery dan hosting

- Target awal Cloudflare Pages, dengan aset statis dan tanpa functions wajib. Konfigurasi dan batas paket harus diperiksa pada saat deployment.
- PMTiles harus dilayani dengan HTTP Range, MIME yang benar, dan header cache. Tes respons byte-range `206` dan pembacaan tile nyata; port terbuka bukan bukti peta bekerja.
- Jika arsip melewati batas file penyedia, pecah per kecamatan dengan indeks cakupan; kabupaten/kecamatan overview tetap kecil. Pembaca memuat shard yang relevan dan menghindari fitur ganda di perbatasan.
- Hash nama aset, cache immutable untuk aset berversi, dan gunakan manifest yang tidak stale. Jangan mencampur indeks dan geometri dari versi dataset berbeda.
- Deep link memakai hash routing untuk kompatibilitas hosting statis tanpa rewrite; misalnya `/#/wilayah/<id>?batas=otomatis&label=1&dasar=kosong`.
- Basemap memakai adapter/config terpisah, atribusi terlihat, dan fallback kosong. Jangan memasang service-worker cache tile penyedia tanpa izin.

## State dan interaksi

```ts
type ViewState = {
  activeRegionId: string;
  boundaryMode: 'auto' | RegionLevel;
  labelsVisible: boolean;
  basemapId: string;
};
```

URL adalah sumber kebenaran untuk konteks dan pengaturan utama. Query yang tidak valid dinormalisasi dengan pesan yang wajar; ID wilayah tidak dikenal menawarkan kembali ke kabupaten. Kamera adalah state terpisah; perpindahan konteks memicu fitBounds dengan padding panel. Kamera tidak perlu disimpan pada setiap gerakan.

Pilihan ekspor adalah koleksi ID terpisah dari wilayah aktif. Hit-testing tile mendeduplikasi fragmen menggunakan ID; klik fragmen tidak menghasilkan pilihan ganda. Fitur agregat tidak boleh dapat dipilih sebagai level anak yang berbeda. Tombol `Buka wilayah` mengubah konteks; `Pilih untuk ekspor` hanya mengubah pilihan.

Pencarian memakai indeks lokal ringkas. Prioritas: kode tepat → nama tepat → prefix → substring. Urutkan hasil setara secara stabil berdasarkan nama dan jalur. Batasi hasil awal dan sediakan pemuatan berikutnya; virtualisasi daftar panjang. Filter subtree memakai relasi node, bukan prefix nama. Pertimbangkan worker hanya setelah profiling menunjukkan kebutuhan.

## Sistem visual

| Token | Nilai awal |
| --- | --- |
| Kanvas/panel | `#F7F7F2` / `#FFFFFF` |
| Teks utama/sekunder | `#202923` / `#526057` |
| Aksen tindakan | `#165A43` |
| Pilihan ekspor | `#A84713` |
| Garis UI | `#DCE2DB` |
| Spacing | 4, 8, 12, 16, 24, 32 px |
| Radius | 6–10 px untuk kontrol/panel |

Warna adalah titik awal yang harus lulus uji kontras pada pasangan aktual. Gunakan bentuk/ketebalan/teks selain warna untuk aktif, terpilih, dan peringatan. Warna isian peta lebih lembut dari outline. Sediakan halo label agar terbaca di berbagai latar.

Gunakan satu keluarga sans-serif self-hosted berlisensi sesuai, dengan fallback system. Teks kontrol minimal 14 px dan teks input mobile 16 px; angka tabel tabular. Tidak memuat font/icon dari layanan eksternal sebagai syarat tampilan.

Desktop (mulai sekitar 900 px): header ringkas, panel kiri sekitar 340 px dengan lebar terbatas, peta mengisi ruang tersisa. Mobile: kolom pencarian atas, tombol layer dan zoom, panel bawah dengan posisi ringkas/setengah/penuh; posisi dapat diubah dengan tombol berlabel. Layout memakai CSS grid/flex, safe-area insets, dan tidak menutupi atribusi atau fokus keyboard.

Kontrol layer dan ekspor berupa drawer/sheet dengan heading, focus management, Escape untuk menutup, serta pengembalian fokus ke pemicu. Daftar wilayah adalah navigasi semantik; jangan mengimplementasikan ARIA tree rumit tanpa dukungan keyboard lengkap. Sediakan status `aria-live`, skip link, focus-visible, dan label setiap input. Animasi singkat hanya transform/opacity dan dinonaktifkan sesuai reduced motion.

## Renderer ekspor

- Renderer khusus menggunakan geometri detail, projection, dan canvas/SVG-ke-canvas; bukan DOM screenshot. Tidak perlu menyertakan WebGL MapLibre dalam pipeline ekspor tanpa basemap.
- Snapshot pilihan dan pengaturan saat proses dimulai sehingga perubahan UI tidak mengubah hasil di tengah proses. Pratinjau dan unduhan memakai layout serta data yang sama, hanya skala output berbeda.
- Hitung extent gabungan dalam EPSG:32750, sisakan padding serta ruang judul/legenda, dan pertahankan rasio aspek. Turunkan skala batang dari meter per piksel. Arah utara harus sesuai proyeksi dan lokasi; hitung konvergensi atau nyatakan north grid jika memakai utara grid.
- Preset awal: layar 1600 × 1000 px; A4 150 dpi sekitar 1240 × 1754 px, dapat ditukar orientasinya. Ukuran khusus: masing-masing sisi 256–4096 px dan maksimum 12 juta piksel. Validasi sebelum alokasi canvas; sediakan pesan pemulihan jika memori perangkat tidak mencukupi.
- Label mengikuti level yang dipilih, collision detection, dan pilihan kode/nama. Jangan memaksakan semua label bertumpuk. Beri pemberitahuan jika ada label yang tidak muat.
- Sumber dan catatan agregasi selalu ada. Transparansi berlaku pada area latar; teks/garis tetap terlihat. Nama file disanitasi.
- Simpan preferensi non-sensitif dalam localStorage dengan versi skema, validasi, dan fallback jika penyimpanan ditolak. Reset mengembalikan default; penghapusan pilihan adalah tindakan terpisah.
- Font harus selesai dimuat sebelum render. Untuk basemap masa depan, periksa izin dan canvas taint/CORS sebelum menawarkan opsi.

## Verifikasi dan target performa

- Unit: parentage, ID ambiguity, `00` leaf, pencarian/subtree, URL normalization, pemilihan lintas level, validasi ukuran ekspor, dan kalkulasi skala.
- Integrasi data: seluruh fitur punya lineage, hasil agregasi valid, tidak ada kehilangan poligon/lubang, tile lookup tepat, ekspor round-trip CRS.
- Browser: jalur kabupaten sampai sub, SLS tanpa sub, nama sama, data ambigu, Back/Forward, URL langsung, layer auto/manual, pilihan lintas induk, PNG aktual, storage ditolak, basemap gagal.
- UI: keyboard-only, fokus modal, reduced motion, 360 px mobile, nama panjang, zoom browser, kontras dan target sentuh. Gunakan audit otomatis serta pemeriksaan manual.
- Hosting: build produksi, deep link, manifest versi konsisten, Range 206 dan tile benar, tidak mengunduh sumber mentah 23 MB saat startup.
- Target awal shell aplikasi ≤300 KB gzip, tidak termasuk engine peta yang dipisah dan data. Catat total transfer kunjungan awal juga; pemisahan chunk tidak membuktikan pengalaman cepat. Profilkan mobile/koneksi terbatas dan tetapkan baseline waktu interaktif sebelum menyatakan target tercapai.

## Tahap dan gerbang keputusan

Gerbang pertama: audit sumber dan registry anomali. Berikutnya: prototipe PMTiles dengan tool versi terkunci dan uji hosting Range/file size. Lanjutkan UI inti, ekspor, lalu audit produksi. Google Maps dan ekspor basemap tetap fitur lanjutan; jangan menghambat MVP yang mandiri tanpa keduanya.

## Catatan implementasi v0.1

Aplikasi, pipeline, aset PMTiles, indeks, shard geometri ekspor, dan tes kini tersedia. Command aktual ada di README.md. Node dipin 24.19.0, tippecanoe 2.79.0. Batas bersama diproses dengan `--detect-shared-borders`; geometri detail tidak disimplifikasi independen. Data tiles zoom 8–14, overzoom untuk detail. Ekspor menggunakan UTM 50S dan penunjuk utara grid yang diberi label.

Penyesuaian awal: font memakai stack sistem agar tidak ada request font eksternal. Label peta memakai overlay DOM dengan satu perhitungan ruang layar per frame. Kandidat di luar viewport disaring; teks diukur sesuai font/style dan ditempatkan hanya jika muat dalam bounding box proyeksi wilayah serta tidak bertumpuk dengan label yang sudah ditempatkan. Tidak ada batas jumlah wilayah tetap; zoom menampilkan kandidat yang baru muat. Basemap hanya kanvas kosong; adapter penyedia berizin masih pekerjaan lanjutan. Nama dan alias asli tetap tersedia dalam indeks. Pemisahan pipeline ke fitur folder lebih rinci dapat dilakukan saat kompleksitas meningkat; saat ini komponen dipisah berdasarkan Map, ExportPanel, export renderer, model dan shell.

Pengujian lokal tidak sama dengan validasi hosting publik. Belum ada klaim profiling perangkat mobile fisik, batas administratif resmi, atau deployment publik. Ukuran shell dan mesin peta dilaporkan terpisah oleh build Vite; arsip peta sekitar 4 MB. Uji kualitas simplifikasi visual pada skala survei dan audit lengkap semua overlap sumber bukan klaim yang dibuat pipeline v0.1.
