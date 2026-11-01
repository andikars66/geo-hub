import proj4 from "proj4";
import type { Region, Regions } from "./model";
export type Options = {
  title: string;
  width: number;
  height: number;
  fill: string;
  line: string;
  opacity: number;
  lineWidth: number;
  transparent: boolean;
  names: boolean;
  codes: boolean;
  children: boolean;
  legend: boolean;
  scale: boolean;
  north: boolean;
};
export const defaults: Options = {
  title: "Peta batas wilayah",
  width: 1600,
  height: 1000,
  fill: "#c5d9c9",
  line: "#165a43",
  opacity: 0.65,
  lineWidth: 2,
  transparent: false,
  names: true,
  codes: false,
  children: false,
  legend: true,
  scale: true,
  north: true,
};
export function validateSize(w: number, h: number) {
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 256 ||
    h < 256 ||
    w > 4096 ||
    h > 4096 ||
    w * h > 12000000
  )
    throw Error(
      "Ukuran harus 256–4096 piksel per sisi, maksimum 12 juta piksel.",
    );
}
const utm = "+proj=utm +zone=50 +south +datum=WGS84 +units=m +no_defs";
export async function renderExport(
  selected: Region[],
  regions: Regions,
  o: Options,
) {
  validateSize(o.width, o.height);
  if (!selected.length) throw Error("Pilih sedikitnya satu wilayah.");
  await document.fonts.ready;
  const ids = new Set(selected.map((r) => r.id));
  if (o.children)
    selected.forEach((r) => r.childIds.forEach((id) => ids.add(id)));
  const refs = [...new Set([...ids].map((id) => regions[id].geometryRef))];
  const collections = await Promise.all(
    refs.map(async (ref) => {
      const r = await fetch(ref);
      if (!r.ok) throw Error("Geometri gagal dimuat. Coba lagi.");
      return r.json();
    }),
  );
  const features = collections
    .flatMap((c) => c.features)
    .filter((f) => ids.has(f.properties.id));
  const project = (p: number[]) => proj4("EPSG:4326", utm, p);
  const prepared = features.map((f) => ({
    ...f,
    polys: (f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates
    ).map((poly: number[][][]) => poly.map((ring) => ring.map(project))),
  }));
  const points: number[][] = prepared.flatMap((f) => f.polys.flat(2));
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  }
  const c = document.createElement("canvas");
  c.width = o.width;
  c.height = o.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw Error("Canvas tidak tersedia. Coba perangkat lain.");
  const u = Math.max(0.5, Math.min(o.width, o.height) / 800),
    pad = 45 * u,
    top = 90 * u,
    bottom = 100 * u;
  const factor = Math.min(
    (o.width - 2 * pad) / (maxX - minX),
    (o.height - top - bottom) / (maxY - minY),
  );
  const ox = (o.width - (maxX - minX) * factor) / 2,
    oy = top + (o.height - top - bottom - (maxY - minY) * factor) / 2;
  const xy = (p: number[]) => [
    ox + (p[0] - minX) * factor,
    oy + (maxY - p[1]) * factor,
  ];
  if (!o.transparent) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.fillStyle = "#202923";
  ctx.font = `600 ${22 * u}px sans-serif`;
  ctx.fillText(o.title.slice(0, 90), pad, 40 * u, o.width - 2 * pad);
  ctx.font = `${11 * u}px sans-serif`;
  ctx.fillText("GeoHub · Kabupaten Lombok Tengah", pad, 62 * u);
  for (const f of prepared) {
    ctx.beginPath();
    for (const poly of f.polys)
      for (const ring of poly) {
        ring.forEach((p: number[], i: number) => {
          const [x, y] = xy(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    ctx.fillStyle = o.fill;
    ctx.globalAlpha =
      ids.has(f.properties.id) && selected.some((r) => r.id === f.properties.id)
        ? o.opacity
        : 0;
    ctx.fill("evenodd");
    ctx.globalAlpha = 1;
    ctx.strokeStyle = o.line;
    ctx.lineWidth = o.lineWidth * u;
    ctx.stroke();
  }
  const boxes: number[][] = [];
  let omitted = 0;
  if (o.names || o.codes)
    for (const f of prepared) {
      const r = regions[f.properties.id];
      const center = project([
        (r.bbox[0] + r.bbox[2]) / 2,
        (r.bbox[1] + r.bbox[3]) / 2,
      ]);
      const [x, y] = xy(center);
      const text = [o.names ? r.name : "", o.codes ? r.sourceCode : ""]
        .filter(Boolean)
        .join(" · ");
      ctx.font = `${12 * u}px sans-serif`;
      const w = ctx.measureText(text).width,
        h = 16 * u;
      const b = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (
        boxes.some(
          (a) => b[0] < a[2] && b[2] > a[0] && b[1] < a[3] && b[3] > a[1],
        )
      ) {
        omitted++;
        continue;
      }
      boxes.push(b);
      ctx.textAlign = "center";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3 * u;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = "#202923";
      ctx.fillText(text, x, y);
      ctx.textAlign = "left";
    }
  if (o.north) {
    ctx.font = `600 ${13 * u}px sans-serif`;
    ctx.fillStyle = "#202923";
    ctx.fillText("↑ N grid", o.width - 110 * u, 40 * u);
  }
  if (o.scale) {
    const maxMeters = (160 * u) / factor;
    const power = 10 ** Math.floor(Math.log10(maxMeters));
    const meters =
      [5, 2, 1].map((v) => v * power).find((v) => v <= maxMeters) || power / 2;
    const len = meters * factor,
      y = o.height - 65 * u;
    ctx.strokeStyle = "#202923";
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(pad, y - 5 * u);
    ctx.lineTo(pad, y);
    ctx.lineTo(pad + len, y);
    ctx.lineTo(pad + len, y - 5 * u);
    ctx.stroke();
    ctx.font = `${11 * u}px sans-serif`;
    ctx.fillText(
      meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
      pad,
      y - 10 * u,
    );
  }
  if (o.legend) {
    ctx.fillStyle = o.fill;
    ctx.fillRect(o.width - 200 * u, o.height - 80 * u, 14 * u, 10 * u);
    ctx.fillStyle = "#202923";
    ctx.font = `${11 * u}px sans-serif`;
    ctx.fillText("Wilayah terpilih", o.width - 178 * u, o.height - 70 * u);
  }
  ctx.fillStyle = "#202923";
  ctx.font = `${9 * u}px sans-serif`;
  ctx.fillText(
    "Sumber: peta_sls_202515202.geojson · Batas agregasi SLS, bukan penetapan batas resmi.",
    pad,
    o.height - 30 * u,
    o.width - 2 * pad,
  );
  ctx.fillText("Proyeksi EPSG:32750 · Utara grid", pad, o.height - 16 * u);
  return { canvas: c, omitted };
}
