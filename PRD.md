# GeoHub — Product Requirements

> Keputusan redesign terbaru: fokus utama adalah mencari dan melihat hierarki wilayah. Peta layar penuh tanpa sidebar kiri; pencarian di tengah atas dengan hasil langsung di bawahnya dan tombol reset. Klik hasil atau poligon membuka wilayah; hover menampilkan nama, kode, jalur dan ringkasan anak. OpenStreetMap menjadi basemap default (atribusi wajib), dengan opsi kanvas kosong. Pengaturan mencakup level batas, label, transparansi, warna tunggal atau warna berbeda per wilayah. Ekspor adalah aksi sekunder pada kartu wilayah aktif; pemilihan banyak wilayah melalui direktori tidak lagi menjadi alur utama versi ini. Ketentuan ini menggantikan layout dan prioritas ekspor versi awal di bawah. Kartu konteks desktop ringkas berada di kiri atas di bawah logo; breadcrumb hanya memuat induk dan unduhan berupa ikon sekunder. Label tidak dibatasi jumlah wilayah: tampil sesuai ruang layar dan benturan teks, diperbarui saat zoom/pan/resize; informasi hover mengikuti pointer dekat poligon, dengan highlight halus. Garis batas anak default 2 px dengan warna independen dari isian. Pengguna dapat mengatur ukuran, warna, tebal dan latar label. Peta selalu datar dan menghadap utara; rotasi/pitch lewat mouse, sentuhan, dan keyboard dinonaktifkan, sementara pan/zoom tetap tersedia. Indikator aktif/fokus memakai hijau, tanpa border cokelat/merah tua. Dialog memakai satu area scroll isi dan dapat ditutup dengan klik di luar, Escape atau tombol tutup; interaksi di dalam tidak menutup dialog.


Status: spesifikasi MVP yang disepakati. Bahasa antarmuka: Indonesia.

## Tujuan

GeoHub adalah platform pemetaan interaktif dan direktori Satuan Lingkungan Setempat (SLS) Kabupaten Lombok Tengah. Pengguna dapat menemukan wilayah, memahami hierarkinya, melihat batas, dan mengunduh gambar peta dengan pengaturan sendiri.

Produk harus ringan, responsif, dapat dioperasikan dengan keyboard, dan dapat di-host sebagai situs statis pada paket gratis. Tidak menjanjikan bahwa kebijakan gratis penyedia akan berlaku selamanya. Tidak membutuhkan backend aplikasi, database hosted, login, atau API berbayar untuk fungsi utama.

## Pengguna dan tugas utama

- Masyarakat mencari lokasi serta induk administratif suatu SLS.
- Petugas menelusuri daftar wilayah dan membandingkan cakupan batas.
- Pengguna menyiapkan gambar batas wilayah untuk laporan atau presentasi.

Alur utama: buka kabupaten → pilih kecamatan → pilih desa/kelurahan → pilih SLS → buka sub-SLS jika tersedia. Pencarian dapat membawa pengguna langsung ke level mana pun.

## Sumber dan kualitas data

Sumber utama: `peta_sls_202515202.geojson`. `peta_sls_20260202.qmd` adalah metadata XML QGIS, bukan dokumen Quarto.

Hasil pemeriksaan awal, bukan jumlah administratif terverifikasi:

| Aspek | Hasil |
| --- | --- |
| Ukuran sumber | Sekitar 23 MB |
| Fitur | 4.630 MultiPolygon, valid dan tidak kosong |
| CRS | EPSG:4326 / WGS84 |
| Kecamatan | 12 |
| Nilai `iddesa` unik | 169 |
| Nilai `idsls` unik | 2.702 |
| Nilai `idsubsls` unik | 4.630 |

Anomali yang diketahui:

1. `iddesa=52020300016` memiliki 11 digit; mayoritas ID desa memiliki 10 digit. Baris terkait bernama Embung Puntik, Kecamatan Praya Timur.
2. `idsls=52020300141001` digunakan oleh dua baris di Pengonak dengan nama `SAWAH (DUSUN AIK PAEK)` dan `SAWAH (DUSUN KULEM)`. Keduanya memiliki kode sub-SLS `00`, sehingga tidak boleh otomatis dianggap dua sub-SLS yang sah.
3. Nama desa tidak unik secara global. Nama tidak dapat menjadi primary key.

Keputusan pengguna: pertahankan sumber dan tampilkan penanda ambiguitas; publikasi tidak harus menunggu koreksi resmi. Jangan menebak ID pengganti. Koreksi terverifikasi kelak disimpan terpisah dengan alasan dan rujukan. Hitungan wilayah bermasalah harus membedakan kelompok ID sumber dan entitas terverifikasi.

Batas kabupaten, kecamatan, desa, dan SLS yang dibangun dari sumber ini adalah hasil agregasi geometri anak, bukan klaim batas resmi dari sumber lain. Tampilkan keterangan pada informasi data dan ekspor. Jangan menebak tanggal pemutakhiran dari nama file.

## Persyaratan fungsional

### F1 — Direktori hierarkis

- Level: kabupaten → kecamatan → desa/kelurahan → SLS → sub-SLS opsional.
- Tampilkan breadcrumb, nama/kode, level, induk, daftar anak, dan hitungan dengan konteks.
- Kode disimpan sebagai string, termasuk nol di depan.
- `kdsubsls=00` tidak menghasilkan anak sub-SLS fiktif. SLS tanpa pembagian menjadi leaf.
- Sub-SLS tanpa nama memakai label `Sub-SLS 01` dan seterusnya.
- Kasus ambigu memiliki penanda dan detail sumber yang dapat diperiksa.

### F2 — Pencarian

- Cari nama atau kode pada seluruh Lombok Tengah atau dalam subtree wilayah aktif.
- Abaikan kapitalisasi dan normalisasikan spasi; dukung kecocokan sebagian.
- Setiap hasil menyertakan level dan jalur induk. Nama sama tidak digabungkan.
- Memilih hasil membuka konteks wilayah dan menyesuaikan kamera agar batas terlihat.
- Sediakan navigasi keyboard, indikator loading, hasil kosong, dan tindakan menghapus filter.

### F3 — Peta dan navigasi

- Pisahkan wilayah aktif, pilihan ekspor, dan kamera peta.
- Pan/zoom tidak mengubah wilayah aktif atau isi direktori.
- Klik/tap wilayah menyediakan tindakan `Buka wilayah` dan `Pilih untuk ekspor`.
- Mengubah wilayah aktif melalui direktori, breadcrumb, atau pencarian menyesuaikan kamera.
- Outline wilayah aktif selalu terlihat. Direktori menjadi alternatif akses untuk memilih wilayah tanpa peta.
- URL menyimpan wilayah aktif dan pengaturan utama; reload, Back/Forward, serta tautan langsung harus bekerja.

### F4 — Pengaturan layer

| Konteks aktif | Default batas anak |
| --- | --- |
| Kabupaten | Kecamatan |
| Kecamatan | Desa/kelurahan |
| Desa/kelurahan | SLS |
| SLS dengan pembagian | Sub-SLS |
| SLS tanpa pembagian / sub-SLS | Tidak ada; tampilkan outline sendiri |

- Pilihan `Otomatis` mengikuti tabel, atau pengguna menentukan level manual yang tersedia dalam subtree aktif.
- Kontrol label, transparansi isian, dan peta dasar tersedia.
- Generalisasi dan penempatan label mengikuti zoom tanpa mengubah pilihan level logis pengguna.
- Gagal memuat basemap tidak mematikan batas, direktori, pencarian, atau ekspor tanpa basemap.

### F5 — Pilih dan unduh PNG

- Pengguna mengaktifkan mode ekspor, memilih satu atau beberapa wilayah pada level yang sama, lalu melihat pratinjau dan mengunduh PNG.
- Pilihan lintas level ditolak dengan alasan yang jelas; jangan membuang pilihan lama tanpa tindakan pengguna.
- Pilihan lintas induk diperbolehkan jika level sama; perubahan konteks tidak menghapusnya. Tampilkan jumlah dan daftar pilihan serta tindakan hapus pilihan.
- Pengaturan: batas anak, label nama/kode, warna isian, transparansi, warna/ketebalan garis, latar putih/transparan, judul, legenda, skala, dan penunjuk utara.
- Ukuran: preset layar, A4, ukuran piksel khusus; orientasi potret/lanskap. Detail batas aman dijelaskan di DESIGN.md.
- Sediakan reset, indikator proses, pesan kesalahan yang dapat ditindaklanjuti, dan simpan preferensi terakhir di perangkat.
- Sumber, keterangan batas agregat, dan atribusi wajib tidak dapat dihilangkan. Jangan menyebut luas atau batas sebagai hasil survei resmi.
- Gunakan geometri detail khusus ekspor, bukan screenshot antarmuka atau tile layar beresolusi rendah.
- MVP mendukung ekspor tanpa basemap. Ekspor basemap bersifat lanjutan setelah hak penggunaan, atribusi, CORS, dan teknis penyedia diverifikasi.

## UI dan aksesibilitas

- Desktop: panel direktori kiri dan peta dominan di kanan. Mobile: pencarian di atas, peta, panel bawah yang juga dapat dibuka/ditutup dengan tombol.
- Fokus visual pada wilayah dan tugas; hindari hero promosi, kartu statistik dekoratif, efek kaca, dan gradien berlebihan.
- Semua tindakan memiliki label, fokus terlihat, dan akses keyboard. Status tidak disampaikan dengan warna saja.
- Hormati reduced motion, safe area, zoom browser, serta nama wilayah panjang. Target sentuh sekurangnya 44 × 44 CSS px untuk kontrol utama.
- Sediakan kondisi loading, kosong, kesalahan data, dan kegagalan jaringan.

## Peta dasar dan biaya

Kanvas tanpa basemap selalu tersedia dan menjadi fallback. Basemap jalan berbasis OSM opsional, hanya memakai penyedia dengan kebijakan yang sesuai; data OSM terbuka tidak berarti tile publik bebas penggunaan tanpa batas. Atribusi harus tampak.

Preferensi pengguna adalah tampilan Google Maps jika memungkinkan. Integrasi Google resmi merupakan tambahan yang perlu API key, pemeriksaan billing/kuota dan ketentuan. Jangan memakai endpoint tile Google tidak resmi. Fungsi utama tidak boleh bergantung padanya.

## Kriteria penerimaan MVP

1. Dari kabupaten, pengguna dapat menelusuri seluruh level dan kembali melalui breadcrumb tanpa kehilangan konteks.
2. SLS tanpa sub tidak menghasilkan anak palsu; wilayah ambigu tidak diam-diam digabung atau dikoreksi.
3. Nama duplikat dapat dibedakan dari jalur; pencarian terbatas tidak mengembalikan wilayah di luar subtree.
4. Semua konteks mengikuti default batas satu level di bawahnya, dengan override manual yang jelas.
5. PNG sesuai pratinjau, hanya memuat pilihan yang dimaksud dan konteks yang diaktifkan, serta memiliki skala dan atribusi benar.
6. Tautan langsung, reload, Back/Forward, dan penanganan ID tidak dikenal bekerja.
7. Alur utama dapat dilakukan dengan keyboard dan pada viewport mobile 360 px tanpa overflow horizontal.
8. Seluruh GeoJSON 23 MB tidak dimuat pada kunjungan awal. Ukur performa pada perangkat mobile dan koneksi terbatas; jangan mengklaim target tercapai tanpa hasil pengukuran.
9. Build statis dan HTTP Range aset peta lolos pengujian pada hosting tujuan. Tidak ada secret atau layanan berbayar yang diwajibkan untuk fungsi inti.

## Di luar MVP

Login, editor batas, dashboard admin, crowdsourced correction, sinkronisasi database, kolaborasi real-time, ekspor shapefile/PDF, routing, dan jaminan offline penuh. Direktori mencakup informasi yang tersedia di sumber; tidak mengarang alamat kontak, penduduk, atau fasilitas.

## Urutan pengerjaan

1. Pipeline dan laporan kualitas data.
2. Indeks hierarki, data peta bertingkat, serta validasi relasi.
3. Direktori, pencarian, peta, URL dan pengaturan layer.
4. Seleksi, renderer PNG, pengaturan dan pratinjau.
5. Audit aksesibilitas, performa, pengujian integrasi, dan deployment statis.

Lihat DESIGN.md untuk keputusan implementasi dan AGENTS.md untuk aturan kerja agent.

## Status implementasi v0.1

Direktori, pencarian hierarkis, peta PMTiles, layer, URL, seleksi dan ekspor PNG berpengaturan sudah diimplementasikan dengan data asli. Dua anomali sumber ditandai tanpa koreksi otomatis. Command pengembangan ada di DEVELOPMENT.md. Basemap OpenStreetMap dan opsi kanvas bersih tersedia; deployment publik belum dilakukan dari sesi pengembangan. Target performa perangkat mobile fisik dan validasi hosting tujuan belum dinyatakan tercapai.
