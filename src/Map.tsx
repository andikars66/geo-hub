import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { levels, type Region, type Regions, displayed } from "./model";
import type { LabelStyle } from "./mapStyle";
import MapLabels from "./MapLabels";
import { ResilientMapSource } from "./mapSource";
import { X } from "lucide-react";
let registered = false;
const protocol = new Protocol();
export default function MapView({
  regions,
  active,
  mode,
  labels,
  opacity,
  tiles,
  selected,
  onHit,
  basemap,
  colorful,
  color,
  lineColor,
  lineWidth,
  labelStyle,
}: {
  regions: Regions;
  active: Region;
  mode: string;
  labels: boolean;
  opacity: number;
  tiles: string;
  selected: string[];
  onHit: (id: string) => void;
  basemap: boolean;
  colorful: boolean;
  color: string;
  lineColor: string;
  lineWidth: number;
  labelStyle: LabelStyle;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltip = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!tooltip.current || !host.current) return;
    const r = tooltip.current.getBoundingClientRect(),
      w = host.current.clientWidth,
      h = host.current.clientHeight;
    setTooltipPosition({
      x: Math.max(
        8,
        pointer.x + 18 + r.width < w
          ? pointer.x + 18
          : pointer.x - r.width - 18,
      ),
      y: Math.max(8, Math.min(pointer.y + 18, h - r.height - 8)),
    });
  }, [hover, pointer]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const host = useRef<HTMLDivElement>(null),
    map = useRef<MLMap>(null);
  const hit = useRef(onHit);
  hit.current = onHit;
  const dismissed = useRef(new Set<string>());
  const [ready, setReady] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [retry, setRetry] = useState(0);
  const setIssue = (source: string, message: string) =>
    !dismissed.current.has(source) &&
    setErrors((previous) =>
      previous[source] === message
        ? previous
        : { ...previous, [source]: message },
    );
  const clearIssue = (source: string) => {
    dismissed.current.delete(source);
    setErrors((previous) => {
      if (!previous[source]) return previous;
      const next = { ...previous };
      delete next[source];
      return next;
    });
  };
  useEffect(() => {
    if (!registered) {
      maplibregl.addProtocol("pmtiles", protocol.tile);
      registered = true;
    }
    // A failed archive header can remain cached; retry must use a fresh reader.
    protocol.add(
      new PMTiles(new ResilientMapSource(new URL(tiles, location.href).href)),
    );
    setReady(false);
    dismissed.current.clear();
    setErrors({});
    const failedTiles = new Map<string, Set<string>>();
    const m = new maplibregl.Map({
      container: host.current!,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
          },
          boundaries: {
            type: "vector",
            url: `pmtiles://${new URL(tiles, location.href).href}`,
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f0f1e9" },
          },
          {
            id: "osm",
            type: "raster",
            source: "osm",
            layout: { visibility: "none" },
          },
        ],
      },
      center: [116.27, -8.68],
      zoom: 9,
      bearing: 0,
      pitch: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
      locale: {
        "NavigationControl.ZoomIn": "Perbesar",
        "NavigationControl.ZoomOut": "Perkecil",
        "NavigationControl.ResetBearing": "Kembalikan arah utara",
        "Map.Title": "Peta batas wilayah",
      },
    });
    map.current = m;
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    m.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-right",
    );
    m.on("load", () => {
      for (const level of levels) {
        m.addLayer({
          id: `fill-${level}`,
          type: "fill",
          source: "boundaries",
          "source-layer": level,
          paint: { "fill-color": "#76a68a", "fill-opacity": 0.18 },
        });
        m.addLayer({
          id: `line-${level}`,
          type: "line",
          source: "boundaries",
          "source-layer": level,
          paint: { "line-color": "#38755a", "line-width": 1.3 },
        });
      }
      m.addSource("active", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "active",
        type: "line",
        source: "active",
        paint: { "line-color": "#123f30", "line-width": 2.5 },
      });
      setReady(true);
    });
    m.on("idle", () => {
      if (host.current && m.getLayer("fill-kabupaten"))
        host.current.dataset.features = String(
          m.queryRenderedFeatures({ layers: levels.map((l) => "fill-" + l) })
            .length,
        );
    });
    m.on("mousemove", (e) => {
      if (!m.getLayer("fill-kabupaten")) return;
      const f = m
        .queryRenderedFeatures(e.point, {
          layers: levels.map((l) => "fill-" + l),
        })
        .find((f) => f.properties?.id);
      setHover(f?.properties.id || null);
      setPointer({ x: e.point.x, y: e.point.y });
      m.getCanvas().style.cursor = f ? "pointer" : "";
    });
    m.on("mouseout", () => setHover(null));
    m.on("movestart", () => setHover(null));
    m.on("click", (e) => {
      if (!m.getLayer("fill-kabupaten")) return;
      const f = m
        .queryRenderedFeatures(e.point, {
          layers: levels.map((l) => "fill-" + l),
        })
        .find((f) => f.properties?.id);
      if (f) {
        setHover(null);
        hit.current(f.properties.id);
      }
    });
    m.on("error", (event) => {
      if (event.error?.name === "AbortError") return;
      const e = event as typeof event & {
        sourceId?: string;
        tile?: { tileID?: { key?: string | number } };
      };
      const source = e.sourceId || "map";
      const key = String(e.tile?.tileID?.key ?? "metadata");
      if (!failedTiles.has(source)) failedTiles.set(source, new Set());
      failedTiles.get(source)!.add(key);
      console.warn("[GeoStamp map]", source, event.error);
      if (source === "osm") {
        m.setLayoutProperty("osm", "visibility", "none");
        setIssue(
          source,
          "OpenStreetMap belum dapat dimuat. Batas wilayah tetap tersedia.",
        );
      } else if (source === "boundaries")
        setIssue(
          source,
          "Batas wilayah gagal dimuat. Periksa koneksi atau coba lagi.",
        );
      else if (source === "active")
        setIssue("outline", "Outline wilayah gagal dimuat. Coba lagi.");
      else setIssue(source, "Peta mengalami kendala tampilan. Coba lagi.");
    });
    m.on("sourcedata", (event) => {
      const e = event as typeof event & {
        sourceId?: string;
        sourceDataType?: string;
        tile?: { tileID?: { key?: string | number }; state?: string };
      };
      if (!e.sourceId) return;
      const failed = failedTiles.get(e.sourceId);
      if (!failed) return;
      if (e.sourceDataType === "metadata") failed.delete("metadata");
      if (e.tile?.state === "loaded") failed.delete(String(e.tile.tileID?.key));
      if (!failed.size)
        clearIssue(e.sourceId === "active" ? "outline" : e.sourceId);
    });
    const resize = new ResizeObserver(() => {
      m.resize();
      const b = activeRef.current.bbox;
      m.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        {
          padding:
            m.getContainer().clientWidth < 900
              ? { top: 150, bottom: 250, left: 35, right: 45 }
              : { top: 110, bottom: 70, left: 80, right: 80 },
          duration: 0,
        },
      );
    });
    resize.observe(host.current!);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, [tiles, retry]);
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    const b = active.bbox;
    m.fitBounds(
      [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      {
        padding:
          m.getContainer().clientWidth < 900
            ? { top: 150, bottom: 250, left: 35, right: 45 }
            : { top: 110, bottom: 70, left: 80, right: 80 },
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 500,
      },
    );
    let alive = true;
    const controller = new AbortController();
    clearIssue("outline");
    fetch(active.geometryRef, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error(`Outline HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!alive) return;
        clearIssue("outline");
        (m.getSource("active") as maplibregl.GeoJSONSource)?.setData({
          type: "FeatureCollection",
          features: d.features.filter(
            (f: any) => f.properties.id === active.id,
          ),
        });
      })
      .catch((error) => {
        if (!alive || error.name === "AbortError") return;
        console.warn("[GeoStamp outline]", error);
        setIssue("outline", "Outline wilayah gagal dimuat. Coba lagi.");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [active, ready]);
  const visible = useMemo(
    () => displayed(regions, active, mode),
    [regions, active, mode],
  );
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    m.setLayoutProperty("osm", "visibility", basemap ? "visible" : "none");
    if (!basemap) clearIssue("osm");
    const palette = [
      "#71a6c8",
      "#bda1d2",
      "#d5ac64",
      "#81b299",
      "#d28f95",
      "#a5b663",
      "#8d9ecc",
    ];
    const colors: any = ["match", ["get", "id"]];
    for (const r of visible) {
      let hash = 0;
      for (const c of r.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
      colors.push(r.id, palette[hash % palette.length]);
    }
    colors.push(color);
    for (const level of levels) {
      const ids = visible.filter((r) => r.level === level).map((r) => r.id);
      const filter: any = ["in", ["get", "id"], ["literal", ids]];
      m.setFilter("fill-" + level, filter);
      m.setFilter("line-" + level, filter);
      m.setPaintProperty("fill-" + level, "fill-opacity", opacity);
      m.setPaintProperty("fill-" + level, "fill-color", [
        "case",
        ["in", ["get", "id"], ["literal", selected]],
        "#43815d",
        colorful && visible.length ? colors : color,
      ]);
      m.setPaintProperty("line-" + level, "line-color", [
        "case",
        ["in", ["get", "id"], ["literal", selected]],
        "#165a43",
        lineColor,
      ]);
      m.setPaintProperty("line-" + level, "line-width", lineWidth);
    }
  }, [
    ready,
    mode,
    active,
    selected,
    opacity,
    regions,
    basemap,
    colorful,
    color,
    lineColor,
    lineWidth,
  ]);
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    for (const level of levels) {
      m.setPaintProperty("fill-" + level, "fill-opacity", [
        "case",
        ["==", ["get", "id"], hover || ""],
        Math.min(opacity + 0.13, 0.9),
        opacity,
      ]);
      m.setPaintProperty("line-" + level, "line-width", [
        "case",
        ["==", ["get", "id"], hover || ""],
        lineWidth + 0.6,
        lineWidth,
      ]);
    }
    m.setPaintProperty("active", "line-color", lineColor);
    m.setPaintProperty("active", "line-width", lineWidth + 1);
  }, [
    ready,
    hover,
    opacity,
    lineWidth,
    lineColor,
    mode,
    active,
    color,
    colorful,
  ]);
  return (
    <div className="map-frame">
      <div
        ref={host}
        className="map-canvas"
        aria-label="Peta batas wilayah Lombok Tengah"
      />
      {!ready && (
        <div className="map-loading" role="status">
          Menyiapkan peta…
        </div>
      )}
      {Object.keys(errors).length > 0 && (
        <div className="map-error" role="alert">
          <button
            className="map-error-close"
            aria-label="Tutup peringatan peta"
            onClick={() => {
              Object.keys(errors).forEach((source) =>
                dismissed.current.add(source),
              );
              setErrors({});
            }}
          >
            <X size={16} />
          </button>
          {Object.entries(errors).map(([source, message]) => (
            <p key={source}>{message}</p>
          ))}
          <button onClick={() => setRetry((v) => v + 1)}>Coba lagi</button>
        </div>
      )}
      {labels && ready && map.current && (
        <MapLabels regions={visible} map={map.current} style={labelStyle} />
      )}
      {hover && regions[hover] && (
        <aside
          ref={tooltip}
          className="hover-card"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            right: "auto",
          }}
          aria-label="Informasi wilayah"
        >
          <span className="eyebrow">{regions[hover].level}</span>
          <h2>{regions[hover].name}</h2>
          <p className="code">{regions[hover].sourceCode}</p>
          <p>{regions[hover].path}</p>
          <strong>{regions[hover].childIds.length} wilayah di bawahnya</strong>
          <ul>
            {regions[hover].childIds.slice(0, 5).map((id) => (
              <li key={id}>{regions[id].name}</li>
            ))}
          </ul>
          {regions[hover].childIds.length > 5 && (
            <small>
              Dan {regions[hover].childIds.length - 5} wilayah lainnya
            </small>
          )}
          <p className="muted">Klik untuk membuka wilayah</p>
        </aside>
      )}
      <div className="map-credit">GeoHub · Batas hasil agregasi data SLS</div>
    </div>
  );
}
