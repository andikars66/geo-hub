import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { levels, type Region, type Regions, displayed } from "./model";
let registered = false;
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
}) {
  const [hover, setHover] = useState<string | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const host = useRef<HTMLDivElement>(null),
    map = useRef<MLMap>(null);
  const hit = useRef(onHit);
  hit.current = onHit;
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!registered) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      registered = true;
    }
    setReady(false);
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
      attributionControl: { compact: true },
      locale: {
        "NavigationControl.ZoomIn": "Perbesar",
        "NavigationControl.ZoomOut": "Perkecil",
        "NavigationControl.ResetBearing": "Kembalikan arah utara",
        "Map.Title": "Peta batas wilayah",
      },
    });
    map.current = m;
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
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
      if (host.current)
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
      m.getCanvas().style.cursor = f ? "pointer" : "";
    });
    m.on("mouseout", () => setHover(null));
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
    m.on("error", (e) => {
      if ((e as any).sourceId === "osm") {
        m.setLayoutProperty("osm", "visibility", "none");
        setError(
          "OpenStreetMap belum dapat dimuat. Batas wilayah tetap tersedia.",
        );
      } else setError("Sebagian data peta gagal dimuat. Coba muat ulang.");
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
  }, [tiles]);
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
    fetch(active.geometryRef)
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (alive)
          (m.getSource("active") as maplibregl.GeoJSONSource)?.setData({
            type: "FeatureCollection",
            features: d.features.filter(
              (f: any) => f.properties.id === active.id,
            ),
          });
      })
      .catch(() =>
        setError("Outline gagal dimuat. Coba buka kembali wilayah."),
      );
    return () => {
      alive = false;
    };
  }, [active, ready]);
  const visible = displayed(regions, active, mode);
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    m.setLayoutProperty("osm", "visibility", basemap ? "visible" : "none");
    if (!basemap) setError("");
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
        "#cd773e",
        colorful && visible.length ? colors : color,
      ]);
      m.setPaintProperty("line-" + level, "line-color", [
        "case",
        ["in", ["get", "id"], ["literal", selected]],
        "#a84713",
        color,
      ]);
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
      {error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}
      {labels && (
        <div className="map-labels" aria-hidden="true">
          {visible.length < 30 &&
            visible.map((r) => (
              <MapLabel
                key={r.id}
                region={r}
                siblings={visible}
                map={map.current}
              />
            ))}
        </div>
      )}
      {hover && regions[hover] && (
        <aside className="hover-card" aria-label="Informasi wilayah">
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
function MapLabel({
  region,
  map,
  siblings,
}: {
  region: Region;
  map: MLMap | null;
  siblings: Region[];
}) {
  const [hidden, setHidden] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const b = region.bbox;
      const p = map.project([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]);
      setPoint(p);
      setHidden(
        siblings
          .slice(
            0,
            siblings.findIndex((r) => r.id === region.id),
          )
          .some((r) => {
            const c = r.bbox,
              q = map.project([(c[0] + c[2]) / 2, (c[1] + c[3]) / 2]);
            return (
              Math.abs(p.x - q.x) <
                (Math.min(160, r.name.length * 6) +
                  Math.min(160, region.name.length * 6)) /
                  2 && Math.abs(p.y - q.y) < 16
            );
          }),
      );
    };
    update();
    map.on("move", update);
    return () => {
      map.off("move", update);
    };
  }, [map, region]);
  return (
    <span
      style={{
        display: hidden ? "none" : undefined,
        left: point.x,
        top: point.y,
      }}
    >
      {region.name}
    </span>
  );
}
