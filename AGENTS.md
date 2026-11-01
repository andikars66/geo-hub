# Panduan Agent — GeoHub

> Keputusan redesign terbaru: fokus utama adalah mencari dan melihat hierarki wilayah. Peta layar penuh tanpa sidebar kiri; pencarian di tengah atas dengan hasil langsung di bawahnya dan tombol reset. Klik hasil atau poligon membuka wilayah; hover menampilkan nama, kode, jalur dan ringkasan anak. OpenStreetMap menjadi basemap default (atribusi wajib), dengan opsi kanvas kosong. Pengaturan mencakup level batas, label, transparansi, warna tunggal atau warna berbeda per wilayah. Ekspor adalah aksi sekunder pada kartu wilayah aktif; pemilihan banyak wilayah melalui direktori tidak lagi menjadi alur utama versi ini. Ketentuan ini menggantikan layout dan prioritas ekspor versi awal di bawah.


## Orientasi wajib

Baca PRD.md dan DESIGN.md sebelum membuat perubahan produk. PRD.md menentukan tujuan, cakupan, dan perilaku; DESIGN.md menentukan rancangan teknis/UI. File ini menentukan cara bekerja. Instruksi terbaru pengguna lebih tinggi prioritasnya. Jika dokumen bertentangan atau keputusan berubah, selesaikan dan perbarui dokumen terkait agar tidak muncul dua kontrak berbeda.

Repository kini memiliki aplikasi React/TypeScript, pipeline Python/tippecanoe, aset hasil build data, unit test dan browser test. Baca README.md untuk command aktual. Jangan mengklaim deployment publik atau validasi yang belum dijalankan.

Gunakan checkout yang ada. Setiap cloud task sudah terisolasi; jangan membuat Git worktree kecuali pengguna memintanya. Periksa status Git sebelum dan sesudah pekerjaan, pertahankan perubahan pengguna, dan hindari mengubah file yang tidak berkaitan.

## Keputusan produk yang mengikat

- Nama: GeoHub. Cakupan: Kabupaten Lombok Tengah. Bahasa UI: Indonesia.
- Hierarki: kabupaten → kecamatan → desa/kelurahan → SLS → sub-SLS opsional.
- Default batas: outline konteks aktif dan batas satu level anak; leaf hanya outline sendiri. Pan/zoom tidak mengubah konteks.
- Pencarian nama/kode menyertakan jalur hierarki dan mendukung filter subtree.
- Wilayah aktif, kamera, dan pilihan ekspor adalah state berbeda. URL mendukung navigasi yang dapat dibagikan dan Back/Forward.
- Ekspor PNG dapat diatur pengguna, satu atau beberapa wilayah pada level sama, dengan pratinjau, reset, dan preferensi lokal. Default tanpa basemap. Atribusi serta sumber wajib tidak dapat dimatikan.
- Sumber ambigu dipertahankan dengan penanda; tidak perlu menunda semua fungsi sampai koreksi resmi tersedia.
- Fungsi inti harus dapat berjalan sebagai website statis tanpa akun, backend, atau API berbayar.
- Google Maps hanya melalui integrasi resmi opsional. Jangan menggunakan endpoint tile Google tidak resmi atau menjanjikan paket gratis selamanya.

## Integritas data

- Jangan menimpa `peta_sls_202515202.geojson` atau `peta_sls_20260202.qmd`. QMD ini XML QGIS, bukan Quarto.
- Semua kode adalah string. Jangan menghapus nol di depan, menyimpulkan parent dari nama, atau memakai `fid` sebagai ID unik.
- Jangan menyamakan jumlah fitur dengan jumlah SLS. Baseline sumber: 4.630 fitur, 2.702 nilai ID SLS, 169 nilai ID desa, 12 kecamatan; angka ini belum semuanya jumlah administratif terverifikasi.
- Tangani eksplisit `iddesa=52020300016` dan konflik `idsls=52020300141001`; ikuti kebijakan node ambigu di DESIGN.md. Jangan memperbaiki ID atau membuat wilayah baru berdasarkan tebakan.
- `kdsubsls=00` tidak menjadi anak sub-SLS. Cek kelompok sebelum membangun hierarki.
- Turunan harus deterministik, menyertakan lineage, checksum sumber, versi skema, dan laporan kualitas. Anomali baru yang merusak identitas harus gagal dengan penjelasan, bukan silent overwrite.
- Koreksi terverifikasi disimpan terpisah dengan rujukan. Tidak ada perubahan data substantif tanpa otorisasi dan bukti.
- Batas agregat diberi keterangan asal-usulnya. Jangan mengklaim batas resmi, tanggal survei, atau statistik yang tidak disediakan sumber.
- Perhitungan spasial harus menggunakan CRS/unit yang benar. Simplifikasi harus menjaga batas bersama, pulau kecil, MultiPolygon, dan lubang.
- Jangan menyertakan kolom path komputer asal pada aset publik.

## Implementasi

Gunakan React, TypeScript, Vite, MapLibre GL JS, PMTiles, serta pipeline Python GeoPandas/Shapely sesuai DESIGN.md. Pin toolchain dan dependency; commit lockfile saat aplikasi dibuat. Hindari layanan runtime tambahan dan dependency besar yang tidak dibutuhkan. Jika perubahan arsitektur diperlukan, jelaskan tradeoff dan perbarui desain sebelum memperluas implementasi.

Mulai dari audit/pipeline data, lalu uji tiles pada hosting, UI inti, ekspor, dan audit produksi. Jangan memuat GeoJSON 23 MB penuh pada startup. Jangan mengganti data nyata dengan demo yang tampak berhasil. Aset geometri detail ekspor dimuat sesuai kebutuhan.

Saat menambahkan tooling, sediakan serta dokumentasikan command nyata untuk setup, pipeline data, dev server, build, typecheck, dan tes. Sesuaikan instruksi dengan working directory sebenarnya. Jangan mengandalkan `/workspace/geo-hub-venv` atau helper di luar repository sebagai prasyarat CI; keduanya hanya fasilitas lingkungan saat perencanaan.

## UI

- Peta dominan, direktori jelas, warna tertahan, dan teks singkat yang membantu tugas. Ikuti token serta layout DESIGN.md.
- Hindari hero promosi, kartu dekoratif, efek kaca, dan gradien tanpa fungsi.
- Gunakan HTML semantik, label input, nama tombol ikon, focus-visible, keyboard, reduced motion, dan safe area. Jangan menyembunyikan outline tanpa pengganti.
- Sediakan alternatif daftar untuk pemilihan peta dan tombol untuk aksi panel yang juga mendukung gesture. Jangan bergantung pada hover atau warna saja.
- Tangani loading, kosong, error, nama panjang, jaringan gagal, storage ditolak, dan ID URL tidak dikenal.
- Jika skill web-design-guidelines tersedia, baca dan gunakan untuk audit kode UI; periksa pedoman terbaru bila jaringan mengizinkan. Catat bila audit belum bisa dijalankan, jangan mengklaim lulus.

## Verifikasi sebelum selesai

Pilih tes berdasarkan perilaku yang berubah. Jalankan pemeriksaan yang tersedia dan relevan; jangan membuat tes yang sekadar menyalin implementasi. Pertahankan status gagal/skip/belum dijalankan secara jujur.

Untuk milestone aplikasi, bukti minimum meliputi build/typecheck, relasi hierarki dan konflik ID, pencarian dengan nama sama/filter subtree, layer otomatis dan manual, deep link/Back/Forward, serta smoke test browser dengan data nyata. Untuk milestone ekspor, periksa PNG hasil sebenarnya, ukuran, pilihan wilayah, label, atribusi, dan skala; keberadaan tombol download saja tidak cukup.

Sebelum deployment, periksa batas ukuran hosting/paket saat itu, HTTP Range 206 dan tile nyata, cache/manifest, serta kegagalan basemap. Ukur payload dan pengalaman mobile; jangan menyebut target performa sebagai hasil tes. Audit keyboard, fokus drawer, layout 360 px, dan reduced motion.

Jangan mengubah tes, menonaktifkan verifikasi TLS/checksum, atau menghilangkan data agar pemeriksaan tampak lulus. Jangan melakukan deploy publik, push, atau memasukkan credential ke repository tanpa otorisasi yang sesuai. Jangan mencatat secret atau environment values dalam log/dokumen.

## Pelaporan dan pemeliharaan dokumen

Selesaikan pekerjaan yang diotorisasi sampai dapat ditinjau; tanyakan hanya keputusan yang benar-benar menghalangi kemajuan dan tidak dapat ditentukan dari dokumen. Laporkan apa yang berubah, verifikasi aktual, dan batasan yang tersisa secara ringkas.

Ketika fitur, schema, command, atau keputusan biaya berubah, perbarui PRD.md/DESIGN.md/AGENTS.md yang relevan dalam perubahan yang sama. Bedakan rencana, implementasi, dan hasil verifikasi. Jangan membiarkan dokumentasi menyatakan fitur sudah tersedia hanya karena telah dirancang.
