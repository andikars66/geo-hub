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
}: {
  regions: Regions;
  active: Region;
  mode: string;
  labels: boolean;
  opacity: number;
  tiles: string;
  selected: string[];
  onHit: (id: string) => void;
}) {
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
        ],
      },
      center: [116.27, -8.68],
      zoom: 9,
      attributionControl: false,
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
    m.on("click", (e) => {
      const f = m
        .queryRenderedFeatures(e.point, {
          layers: levels.map((l) => "fill-" + l),
        })
        .find((f) => f.properties?.id);
      if (f) hit.current(f.properties.id);
    });
    m.on("error", () =>
      setError(
        "Sebagian data peta gagal dimuat. Coba muat ulang; direktori tetap dapat digunakan.",
      ),
    );
    const resize = new ResizeObserver(() => {
      m.resize();
      const b = activeRef.current.bbox;
      m.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: 45, duration: 0 },
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
        padding: 45,
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
        "#8bb69a",
      ]);
      m.setPaintProperty("line-" + level, "line-color", [
        "case",
        ["in", ["get", "id"], ["literal", selected]],
        "#a84713",
        "#397658",
      ]);
    }
  }, [ready, mode, active, selected, opacity, regions]);
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
              <MapLabel key={r.id} region={r} map={map.current} />
            ))}
        </div>
      )}
      <div className="map-credit">GeoHub · Batas hasil agregasi data SLS</div>
    </div>
  );
}
function MapLabel({ region, map }: { region: Region; map: MLMap | null }) {
  const [point, setPoint] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const b = region.bbox;
      setPoint(map.project([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]));
    };
    update();
    map.on("move", update);
    return () => {
      map.off("move", update);
    };
  }, [map, region]);
  return <span style={{ left: point.x, top: point.y }}>{region.name}</span>;
}
