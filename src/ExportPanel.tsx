import { useEffect, useRef, useState } from "react";
import { defaults, renderExport, validateSize, type Options } from "./export";
import type { Region, Regions } from "./model";
function loadOptions(): Options {
  try {
    const stored = JSON.parse(
      localStorage.getItem("geohub-export-v1") || "null",
    );
    if (!stored) return defaults;
    const o = { ...defaults };
    for (const k of Object.keys(defaults) as (keyof Options)[]) {
      if (typeof stored[k] === typeof defaults[k]) (o as any)[k] = stored[k];
    }
    validateSize(o.width, o.height);
    if (!/^#[\da-f]{6}$/i.test(o.fill) || !/^#[\da-f]{6}$/i.test(o.line))
      return defaults;
    o.opacity = Math.max(0, Math.min(1, o.opacity));
    o.lineWidth = Math.max(1, Math.min(8, o.lineWidth));
    return o;
  } catch {
    return defaults;
  }
}
export default function ExportPanel({
  selected,
  regions,
  onRemove,
}: {
  selected: Region[];
  regions: Regions;
  onRemove: (id: string) => void;
}) {
  const [o, setO] = useState<Options>(loadOptions),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [snapshot, setSnapshot] = useState("");
  const [preset, setPreset] = useState(
    o.width === 1600 && o.height === 1000
      ? "screen"
      : o.width === 1240 && o.height === 1754
        ? "a4"
        : "custom",
  );
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem("geohub-export-v1", JSON.stringify(o));
    } catch {
      /* Preferences are optional. */
    }
  }, [o]);
  const key = JSON.stringify([selected.map((r) => r.id), o]);
  const fresh = snapshot === key;
  function change<K extends keyof Options>(k: K, v: Options[K]) {
    if (k === "width" || k === "height") setPreset("custom");
    setO((x) => ({ ...x, [k]: v }));
  }
  async function generate() {
    setBusy(true);
    setMessage("Menyiapkan pratinjau…");
    try {
      const result = await renderExport(selected, regions, { ...o });
      canvas.current = result.canvas;
      setPreview(result.canvas.toDataURL("image/png"));
      setSnapshot(key);
      setMessage(
        result.omitted
          ? `${result.omitted} label tidak muat dan disembunyikan. Perbesar ukuran atau kurangi label.`
          : "Pratinjau siap.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!canvas.current || !fresh) return;
    canvas.current.toBlob((blob) => {
      if (!blob) {
        setMessage("PNG gagal dibuat. Kurangi ukuran gambar.");
        return;
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `geohub-${selected.length}-wilayah.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return (
    <>
      <p className="muted">
        Peta tanpa basemap, dengan geometri detail. Pilih wilayah melalui
        direktori atau peta.
      </p>
      <div className="selection-list">
        {selected.map((r) => (
          <div key={r.id}>
            <span>{r.name}</span>
            <button
              aria-label={`Hapus ${r.name}`}
              onClick={() => onRemove(r.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {!selected.length && (
        <p className="notice">Belum ada wilayah terpilih.</p>
      )}
      <label>
        Judul
        <input
          maxLength={90}
          value={o.title}
          onChange={(e) => change("title", e.target.value)}
        />
      </label>
      <label>
        Ukuran
        <select
          value={preset}
          onChange={(e) => {
            setPreset(e.target.value);
            if (e.target.value === "screen")
              setO((x) => ({ ...x, width: 1600, height: 1000 }));
            if (e.target.value === "a4")
              setO((x) => ({ ...x, width: 1240, height: 1754 }));
          }}
        >
          <option value="screen">Layar · 1600 × 1000</option>
          <option value="a4">A4 · 150 dpi</option>
          <option value="custom">Piksel khusus</option>
        </select>
      </label>
      <div className="two-col">
        <label>
          Lebar (px)
          <input
            type="number"
            min={256}
            max={4096}
            value={o.width}
            onChange={(e) => change("width", +e.target.value)}
          />
        </label>
        <label>
          Tinggi (px)
          <input
            type="number"
            min={256}
            max={4096}
            value={o.height}
            onChange={(e) => change("height", +e.target.value)}
          />
        </label>
      </div>
      <button
        onClick={() => (
          setPreset("custom"),
          setO((x) => ({ ...x, width: x.height, height: x.width }))
        )}
      >
        Tukar orientasi
      </button>
      <div className="two-col">
        <label>
          Warna isian
          <input
            type="color"
            value={o.fill}
            onChange={(e) => change("fill", e.target.value)}
          />
        </label>
        <label>
          Warna garis
          <input
            type="color"
            value={o.line}
            onChange={(e) => change("line", e.target.value)}
          />
        </label>
      </div>
      <label>
        Transparansi isian · {Math.round(o.opacity * 100)}%
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={o.opacity}
          onChange={(e) => change("opacity", +e.target.value)}
        />
      </label>
      <label>
        Ketebalan garis · {o.lineWidth}
        <input
          type="range"
          min="1"
          max="8"
          value={o.lineWidth}
          onChange={(e) => change("lineWidth", +e.target.value)}
        />
      </label>
      <fieldset>
        <legend>Isi gambar</legend>
        {(
          [
            ["names", "Nama wilayah"],
            ["codes", "Kode wilayah"],
            ["children", "Batas satu level anak"],
            ["transparent", "Latar transparan"],
            ["legend", "Legenda"],
            ["scale", "Skala"],
            ["north", "Penunjuk utara grid"],
          ] as const
        ).map(([k, label]) => (
          <label className="check" key={k}>
            <input
              type="checkbox"
              checked={o[k]}
              onChange={(e) => change(k, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="muted small">
        Sumber dan catatan batas agregat selalu dicantumkan. Maksimum 12 juta
        piksel.
      </p>
      <button
        onClick={() => {
          setO({ ...defaults });
          setPreset("screen");
        }}
      >
        Reset pengaturan
      </button>
      <button
        className="primary"
        disabled={busy || !selected.length}
        onClick={generate}
      >
        {busy ? "Menyiapkan…" : "Buat pratinjau"}
      </button>
      <p role="status">{message}</p>
      {preview && (
        <>
          <img
            className="export-preview"
            src={preview}
            width={o.width}
            height={o.height}
            alt="Pratinjau gambar batas wilayah"
          />
          {!fresh && (
            <p className="notice">
              Pilihan berubah. Buat ulang pratinjau sebelum mengunduh.
            </p>
          )}
          <button
            className="primary"
            disabled={!fresh || busy}
            onClick={download}
          >
            Unduh PNG
          </button>
        </>
      )}
    </>
  );
}
