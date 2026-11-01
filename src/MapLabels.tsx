import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Region } from "./model";
import type { LabelStyle } from "./mapStyle";
import { layoutLabels, type LabelCandidate } from "./labelLayout";
export default function MapLabels({
  regions,
  map,
  style,
}: {
  regions: Region[];
  map: MapLibreMap;
  style: LabelStyle;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<LabelCandidate[]>([]);
  useEffect(() => {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    context.font = `${style.bold ? 700 : 400} ${style.size}px ${getComputedStyle(host.current!).fontFamily}`;
    const metrics = regions.map((r) => ({
      r,
      width:
        Math.ceil(context.measureText(r.name).width) +
        (style.background ? 12 : 0),
      height: style.size * 1.35 + (style.background ? 6 : 0),
    }));
    let frame = 0,
      alive = true;
    const update = () => {
      frame = 0;
      const container = map.getContainer();
      const bounds = map.getBounds();
      const candidates = metrics
        .filter(
          ({ r }) =>
            r.bbox[2] >= bounds.getWest() &&
            r.bbox[0] <= bounds.getEast() &&
            r.bbox[3] >= bounds.getSouth() &&
            r.bbox[1] <= bounds.getNorth(),
        )
        .map(({ r, width, height }) => {
          const [west, south, east, north] = r.bbox;
          const center = map.project([(west + east) / 2, (south + north) / 2]);
          const corners = [
            [west, south],
            [west, north],
            [east, south],
            [east, north],
          ].map((p) => map.project(p as [number, number]));
          return {
            id: r.id,
            name: r.name,
            x: center.x,
            y: center.y,
            width,
            height,
            availableWidth:
              Math.max(...corners.map((p) => p.x)) -
              Math.min(...corners.map((p) => p.x)),
            availableHeight:
              Math.max(...corners.map((p) => p.y)) -
              Math.min(...corners.map((p) => p.y)),
          };
        });
      setPlaced(
        layoutLabels(candidates, container.clientWidth, container.clientHeight),
      );
    };
    const schedule = () => {
      if (alive && !frame) frame = requestAnimationFrame(update);
    };
    schedule();
    map.on("move", schedule);
    map.on("resize", schedule);
    document.fonts.ready.then(schedule);
    return () => {
      alive = false;
      map.off("move", schedule);
      map.off("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [regions, map, style]);
  return (
    <div ref={host} className="map-labels adaptive-labels" aria-hidden="true">
      {placed.map((c) => (
        <span
          key={c.id}
          data-region-id={c.id}
          style={{
            left: c.x,
            top: c.y,
            fontSize: style.size,
            color: style.color,
            fontWeight: style.bold ? 700 : 400,
            background: style.background
              ? style.backgroundColor
              : "transparent",
            padding: style.background ? "3px 6px" : 0,
            borderRadius: 4,
            textShadow: style.background ? "none" : undefined,
          }}
        >
          {c.name}
        </span>
      ))}
    </div>
  );
}
