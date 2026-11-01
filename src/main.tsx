import { StrictMode, Suspense, lazy, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Map as MapIcon,
  Search,
  Layers,
  Download,
  ChevronRight,
  ArrowUpRight,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Info,
  X,
  LocateFixed,
} from "lucide-react";
import {
  labels,
  levels,
  rootId,
  viewFromHash,
  search,
  toggleSelection,
  type Regions,
  type Region,
} from "./model";
import "./style.css";
const MapView = lazy(() => import("./Map"));
const ExportPanel = lazy(() => import("./ExportPanel"));
function App() {
  const [regions, setRegions] = useState<Regions | null>(null),
    [tiles, setTiles] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      fetch("/data/manifest.json").then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
    ])
      .then(async ([m]) => {
        const r = await fetch(m.regions);
        if (!r.ok) throw Error();
        setRegions(await r.json());
        setTiles(m.tiles);
      })
      .catch(() =>
        setError("Data wilayah gagal dimuat. Periksa koneksi lalu muat ulang."),
      );
  }, []);
  if (error)
    return (
      <main className="loading">
        <h1>GeoHub</h1>
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Muat ulang</button>
      </main>
    );
  if (!regions)
    return (
      <main className="loading" role="status">
        <MapIcon />
        <h1>GeoHub</h1>
        <p>Memuat direktori Lombok Tengah…</p>
      </main>
    );
  return <Workspace regions={regions} tiles={tiles} />;
}
function Workspace({ regions, tiles }: { regions: Regions; tiles: string }) {
  const [hash, setHash] = useState(location.hash),
    [q, setQ] = useState(""),
    [scope, setScope] = useState(false),
    [limit, setLimit] = useState(40),
    [selected, setSelected] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [panel, setPanel] = useState<"layer" | "export" | "info" | null>(null),
    [opacity, setOpacity] = useState(0.23),
    [fitKey, setFitKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false),
    [basemap, setBasemap] = useState(true),
    [colorful, setColorful] = useState(false),
    [color, setColor] = useState("#56936e");
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const view = viewFromHash(hash, regions),
    active = regions[view.id];
  useEffect(() => {
    const f = () => {
      setHash(location.hash);
      setLimit(40);
    };
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  useEffect(() => {
    setLimit(40);
  }, [q, scope]);
  useEffect(() => {
    if (view.invalid) {
      setNotice(
        "Wilayah pada tautan tidak dikenal. Menampilkan Kabupaten Lombok Tengah.",
      );
      location.replace("#/wilayah/" + rootId);
    }
  }, [view.invalid]);
  useEffect(() => {
    if (panel) {
      opener.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      opener.current?.focus();
    }
  }, [panel]);
  function navigate(id: string, mode = view.mode, showLabels = view.labels) {
    location.hash = `/wilayah/${encodeURIComponent(id)}?batas=${mode}&label=${showLabels ? "1" : "0"}`;
    setQ("");
    setSearchOpen(false);
  }
  const results = q.trim()
    ? search(regions, q, scope ? active.id : undefined)
    : active.childIds.map((id) => regions[id]);
  const modeOptions = levels.filter(
    (l) => levels.indexOf(l) >= levels.indexOf(active.level),
  );
  return (
    <>
      <a
        className="skip"
        href="#search"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("search")?.focus();
        }}
      >
        Lewati ke pencarian
      </a>
      <header className="explore-brand">
        <a className="brand" href={"#/wilayah/" + rootId}>
          <span className="brand-icon">
            <MapIcon size={24} />
          </span>
          <span>
            GeoHub<small>LOMBOK TENGAH</small>
          </span>
        </a>
      </header>
      <main
        className="explore-map"
        aria-label="Peta interaktif"
        onPointerDown={() => setSearchOpen(false)}
      >
        <Suspense fallback={<p className="loading">Memuat peta…</p>}>
          <MapView
            key={fitKey}
            regions={regions}
            active={active}
            mode={view.mode}
            labels={view.labels}
            opacity={opacity}
            selected={[]}
            tiles={tiles}
            basemap={basemap}
            colorful={colorful}
            color={color}
            onHit={(id) => navigate(id)}
          />
        </Suspense>
      </main>
      <section className="explore-search" aria-label="Pencarian wilayah">
        <div className="searchbox">
          <Search size={20} />
          <input
            id="search"
            aria-label="Cari nama atau kode wilayah"
            placeholder="Mau lihat wilayah mana?"
            autoComplete="off"
            value={q}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
            }}
            onChange={(e) => {
              setQ(e.target.value);
              setSearchOpen(true);
            }}
          />
          <button
            aria-label="Reset pencarian"
            onClick={() => {
              setQ("");
              setSearchOpen(false);
            }}
          >
            <X size={18} />
          </button>
        </div>
        {searchOpen && (
          <div className="search-results">
            <label className="check">
              <input
                type="checkbox"
                checked={scope}
                onChange={(e) => setScope(e.target.checked)}
              />
              Dalam {active.name}
            </label>
            <div className="list-caption">
              <h2>{q ? "Hasil pencarian" : "Jelajahi wilayah di bawahnya"}</h2>
              <span>{results.length}</span>
            </div>
            {results.slice(0, limit).map((r) => (
              <button
                className="search-result"
                key={r.id}
                onClick={() => navigate(r.id)}
              >
                <span>
                  <strong>
                    {r.name}
                    {r.qualityFlags.length > 0 ? " ⚠" : ""}
                  </strong>
                  <small>
                    {labels[r.level]} · {r.path}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {!results.length && (
              <p className="empty">
                {q
                  ? "Tidak ada wilayah yang cocok. Coba nama atau kode lain."
                  : "Tidak ada pembagian wilayah lebih lanjut."}
              </p>
            )}
            {results.length > limit && (
              <button onClick={() => setLimit((n) => n + 40)}>
                Tampilkan berikutnya
              </button>
            )}
          </div>
        )}
      </section>
      <div className="explore-actions">
        <button aria-label="Pengaturan peta" onClick={() => setPanel("layer")}>
          <Layers size={20} />
        </button>
        <button
          aria-label="Sesuaikan peta ke wilayah aktif"
          onClick={() => setFitKey((n) => n + 1)}
        >
          <LocateFixed size={20} />
        </button>
        <button aria-label="Tentang data" onClick={() => setPanel("info")}>
          <Info size={20} />
        </button>
      </div>
      <section className="context-panel" aria-label="Wilayah aktif">
        <nav className="breadcrumbs" aria-label="Hierarki wilayah">
          {active.ancestors.map((id, i) => (
            <span key={id}>
              {i > 0 && <ChevronRight size={12} />}
              <a
                href={`#/wilayah/${encodeURIComponent(id)}`}
                aria-current={id === active.id ? "page" : undefined}
              >
                {regions[id].name}
              </a>
            </span>
          ))}
        </nav>
        <div className="context-main">
          <div>
            <span className="eyebrow">{labels[active.level]}</span>
            <h1>{active.name}</h1>
            <span className="code">{active.sourceCode}</span>
          </div>
          <button onClick={() => setSearchOpen(!searchOpen)}>
            {active.childIds.length} wilayah <ChevronRight size={16} />
          </button>
        </div>
        {active.qualityFlags.length > 0 && (
          <details className="notice">
            <summary>Data perlu pemeriksaan</summary>
            <p>
              {active.qualityFlags.includes("ambiguous-source-id")
                ? "Satu kode dipakai beberapa nama. Kelompok sumber dipertahankan."
                : "Format kode desa berbeda dari entri lain."}
            </p>
            {active.aliases.join(" · ")}
          </details>
        )}
        <div className="context-footer">
          <span>Klik batas untuk menjelajah lebih dalam</span>
          <button
            aria-label="Unduh peta wilayah aktif"
            onClick={() => {
              setSelected([active.id]);
              setPanel("export");
            }}
          >
            <Download size={14} />
            Unduh
          </button>
        </div>
      </section>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        aria-labelledby="panel-heading"
        ref={dialog}
        onCancel={() => setPanel(null)}
        onClose={() => setPanel(null)}
      >
        <div className="dialog-head">
          <h2 id="panel-heading">
            {panel === "layer"
              ? "Pengaturan layer"
              : panel === "export"
                ? "Ekspor peta"
                : "Tentang data GeoHub"}
          </h2>
          <button aria-label="Tutup panel" onClick={() => setPanel(null)}>
            <X size={20} />
          </button>
        </div>
        <div className="dialog-body">
          {panel === "layer" && (
            <>
              <p className="muted">
                Atur batas dalam wilayah aktif. Peta tetap mengikuti konteks
                direktori.
              </p>
              <label>
                Level batas
                <select
                  value={view.mode}
                  onChange={(e) => navigate(active.id, e.target.value)}
                >
                  <option value="auto">Otomatis · satu level di bawah</option>
                  {modeOptions.map((l) => (
                    <option key={l} value={l}>
                      {labels[l]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={view.labels}
                  onChange={(e) =>
                    navigate(active.id, view.mode, e.target.checked)
                  }
                />
                Tampilkan label
              </label>
              <p className="muted small">
                Label peta ditampilkan untuk paling banyak 29 wilayah sekaligus
                agar tetap terbaca. Gunakan direktori untuk daftar lengkap.
              </p>
              <label>
                Transparansi isian · {Math.round(opacity * 100)}%
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.01"
                  value={opacity}
                  onChange={(e) => setOpacity(+e.target.value)}
                />
              </label>
              <label>
                Peta dasar
                <select
                  value={basemap ? "osm" : "none"}
                  onChange={(e) => setBasemap(e.target.value === "osm")}
                >
                  <option value="osm">OpenStreetMap</option>
                  <option value="none">Kanvas bersih</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={colorful}
                  onChange={(e) => setColorful(e.target.checked)}
                />
                Warna berbeda setiap wilayah
              </label>
              <label>
                Warna batas dan isian
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
              <p className="muted">
                Peta dasar © OpenStreetMap contributors. Jika jaringan tidak
                tersedia, batas wilayah tetap dapat digunakan.
              </p>
            </>
          )}
          {panel === "export" && (
            <Suspense fallback={<p>Memuat pengaturan…</p>}>
              <ExportPanel
                selected={selected.map((id) => regions[id])}
                regions={regions}
                onRemove={(id) =>
                  setSelected((ids) => ids.filter((i) => i !== id))
                }
              />
            </Suspense>
          )}
          {panel === "info" && (
            <>
              <p>
                GeoHub membantu menjelajahi batas wilayah dan direktori Satuan
                Lingkungan Setempat di Kabupaten Lombok Tengah.
              </p>
              <h3>Sumber</h3>
              <p className="code">peta_sls_202515202.geojson</p>
              <p>
                4.630 fitur sumber · 12 kecamatan · 169 ID desa · 2.702 ID SLS.
                Jumlah ID sumber bukan seluruhnya jumlah administratif
                terverifikasi.
              </p>
              <p>
                Batas hasil agregasi geometri SLS, bukan penetapan batas resmi.
                Tanggal pemutakhiran belum terverifikasi.
              </p>
              <h3>Catatan kualitas</h3>
              <p>
                Satu ID desa berbeda format dan satu ID SLS digunakan dua nama
                dusun. Sumber dipertahankan; entri terkait diberi penanda.
              </p>
              <button
                onClick={() => {
                  navigate("desa:52020300016");
                  setPanel(null);
                }}
              >
                Lihat kode desa berbeda format
              </button>
              <button
                onClick={() => {
                  navigate("sls:52020300141001");
                  setPanel(null);
                }}
              >
                Lihat SLS dengan nama ambigu
              </button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
