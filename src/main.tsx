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
    [collapsed, setCollapsed] = useState(false),
    [hit, setHit] = useState<string | null>(null),
    [opacity, setOpacity] = useState(0.23),
    [fitKey, setFitKey] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const view = viewFromHash(hash, regions),
    active = regions[view.id];
  useEffect(() => {
    const f = () => {
      setHash(location.hash);
      setLimit(40);
      setHit(null);
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
    setCollapsed(false);
  }
  function select(r: Region) {
    try {
      const next = toggleSelection(selected, r, regions);
      setSelected(next);
      setNotice(
        next.includes(r.id)
          ? `${r.name} dipilih untuk ekspor.`
          : "Pilihan dihapus.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const results = q.trim()
    ? search(regions, q, scope ? active.id : undefined)
    : active.childIds.map((id) => regions[id]);
  const modeOptions = levels.filter(
    (l) => levels.indexOf(l) >= levels.indexOf(active.level),
  );
  const opened = hit ? regions[hit] : null;
  return (
    <>
      <a className="skip" href="#directory">
        Lewati ke direktori
      </a>
      <header className="topbar">
        <a className="brand" href={"#/wilayah/" + rootId}>
          <span className="brand-icon">
            <MapIcon size={24} />
          </span>
          <span>
            GeoHub<small>LOMBOK TENGAH</small>
          </span>
        </a>
        <div className="header-note">
          Direktori & peta wilayah<span> Nusa Tenggara Barat</span>
        </div>
        <button className="quiet" onClick={() => setPanel("info")}>
          <Info size={17} />
          <span>Tentang data</span>
        </button>
        <button
          className="primary export-top"
          onClick={() => setPanel("export")}
        >
          <Download size={17} />
          Ekspor peta{selected.length > 0 && <b>{selected.length}</b>}
        </button>
      </header>
      <div className={"workspace " + (collapsed ? "collapsed" : "")}>
        <aside className="sidebar" id="directory" tabIndex={-1}>
          <div className="sidebar-head">
            <span className="eyebrow">JELAJAHI WILAYAH</span>
            <button
              className="mobile-toggle"
              aria-label={collapsed ? "Buka direktori" : "Ringkas direktori"}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
          </div>
          <div className="searchbox">
            <Search size={18} />
            <input
              aria-label="Cari nama atau kode wilayah"
              placeholder="Cari nama atau kode wilayah…"
              name="wilayah"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button aria-label="Hapus pencarian" onClick={() => setQ("")}>
                <X size={16} />
              </button>
            )}
          </div>
          <label className="check scope">
            <input
              type="checkbox"
              checked={scope}
              onChange={(e) => setScope(e.target.checked)}
            />
            Cari dalam wilayah ini
          </label>
          <nav className="breadcrumbs" aria-label="Hierarki wilayah">
            {active.ancestors.map((id, i) => (
              <span key={id}>
                {i > 0 && <ChevronRight size={11} />}
                <a
                  href={`#/wilayah/${encodeURIComponent(id)}?batas=${view.mode}&label=${view.labels ? "1" : "0"}`}
                  aria-current={id === active.id ? "page" : undefined}
                >
                  {regions[id].name}
                </a>
              </span>
            ))}
          </nav>
          <div className="region-summary">
            <span className="eyebrow">{labels[active.level]}</span>
            <h1>{active.name}</h1>
            <p className="code">{active.sourceCode}</p>
            {active.qualityFlags.length > 0 && (
              <div className="notice">
                <strong>Perlu pemeriksaan data</strong>
                <p>
                  {active.qualityFlags.includes("ambiguous-source-id")
                    ? "Satu kode dipakai beberapa nama. Ditampilkan sebagai kelompok ID sumber."
                    : "Format kode sumber berbeda; belum dikoreksi."}
                </p>
                {active.aliases.map((a) => (
                  <div key={a}>{a}</div>
                ))}
              </div>
            )}
            <button
              className={
                "select-button " +
                (selected.includes(active.id) ? "selected" : "")
              }
              onClick={() => select(active)}
            >
              {selected.includes(active.id) ? (
                <Check size={16} />
              ) : (
                <Download size={16} />
              )}{" "}
              {selected.includes(active.id)
                ? "Terpilih untuk ekspor"
                : "Pilih wilayah ini"}
            </button>
          </div>
          <div className="list-caption">
            <h2>
              {q.trim()
                ? "Hasil pencarian"
                : active.childIds.length
                  ? `Daftar ${labels[regions[active.childIds[0]].level].toLowerCase()}`
                  : "Wilayah terakhir"}
            </h2>
            <span>{new Intl.NumberFormat("id").format(results.length)}</span>
          </div>
          <div className="region-list">
            {results.slice(0, limit).map((r) => (
              <div className="region-row" key={r.id}>
                <button className="region-link" onClick={() => navigate(r.id)}>
                  <span className="region-name">
                    {r.name}
                    {r.qualityFlags.length > 0 && (
                      <span
                        className="flag"
                        aria-label="Data perlu pemeriksaan"
                      >
                        !
                      </span>
                    )}
                    <small>
                      {q.trim()
                        ? `${labels[r.level]} · ${r.path}`
                        : r.sourceCode}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
                <button
                  className={
                    "pick " + (selected.includes(r.id) ? "is-picked" : "")
                  }
                  aria-label={`${selected.includes(r.id) ? "Hapus pilihan" : "Pilih"} ${r.name}`}
                  aria-pressed={selected.includes(r.id)}
                  onClick={() => select(r)}
                >
                  {selected.includes(r.id) ? (
                    <Check size={16} />
                  ) : (
                    <span>+</span>
                  )}
                </button>
              </div>
            ))}
            {!results.length && (
              <div className="empty">
                <MapIcon size={28} />
                <p>
                  {q
                    ? "Tidak ada wilayah yang cocok. Coba nama lain atau perluas cakupan."
                    : "Wilayah ini tidak memiliki pembagian lebih lanjut."}
                </p>
              </div>
            )}
            {results.length > limit && (
              <button
                className="load-more"
                onClick={() => setLimit((n) => n + 40)}
              >
                Tampilkan 40 berikutnya
              </button>
            )}
          </div>
          <footer className="sidebar-foot">
            <span className="live-dot" />
            Data batas SLS · WGS84
            <small>Hitungan mengikuti ID sumber, termasuk entri ambigu.</small>
          </footer>
        </aside>
        <main className="map-area" aria-label="Peta interaktif">
          <div className="map-toolbar">
            <span className="context-chip">
              <span className="live-dot" />
              {labels[active.level]} · {active.name}
            </span>
            <div>
              <button
                onClick={() => setFitKey((n) => n + 1)}
                aria-label="Sesuaikan peta ke wilayah aktif"
              >
                <LocateFixed size={18} />
              </button>
              <button onClick={() => setPanel("layer")}>
                <Layers size={17} />
                Layer
              </button>
            </div>
          </div>
          <Suspense
            fallback={
              <div role="status" className="map-loading">
                Memuat mesin peta…
              </div>
            }
          >
            <MapView
              key={fitKey}
              regions={regions}
              active={active}
              mode={view.mode}
              labels={view.labels}
              opacity={opacity}
              selected={selected}
              tiles={tiles}
              onHit={setHit}
            />
          </Suspense>
          <div className="map-legend">
            <strong>
              <span />
              Batas{" "}
              {view.mode === "auto"
                ? "otomatis"
                : labels[view.mode as keyof typeof labels]}
            </strong>
            <span>Outline gelap: wilayah aktif</span>
            {selected.length > 0 && (
              <button onClick={() => setPanel("export")}>
                {selected.length} wilayah terpilih <ArrowUpRight size={14} />
              </button>
            )}
          </div>
          {opened && (
            <section className="feature-card" aria-label="Wilayah pada peta">
              <button
                className="card-close"
                aria-label="Tutup detail wilayah"
                onClick={() => setHit(null)}
              >
                <X size={16} />
              </button>
              <span className="eyebrow">{labels[opened.level]}</span>
              <h2>{opened.name}</h2>
              <p className="code">{opened.sourceCode}</p>
              <div>
                <button className="primary" onClick={() => navigate(opened.id)}>
                  Buka wilayah
                </button>
                <button onClick={() => select(opened)}>
                  {selected.includes(opened.id)
                    ? "Hapus pilihan"
                    : "Pilih untuk ekspor"}
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
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
                <select value="none" onChange={() => {}}>
                  <option value="none">Kanvas bersih · tanpa basemap</option>
                </select>
              </label>
              <p className="notice">
                Basemap jalan dan Google Maps belum diaktifkan. Peta batas dan
                ekspor tetap berfungsi tanpa layanan berbayar.
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
