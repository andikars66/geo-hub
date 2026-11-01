export const levels = [
  "kabupaten",
  "kecamatan",
  "desa",
  "sls",
  "subsls",
] as const;
export type Level = (typeof levels)[number];
export const labels: Record<Level, string> = {
  kabupaten: "Kabupaten",
  kecamatan: "Kecamatan",
  desa: "Desa / kelurahan",
  sls: "SLS",
  subsls: "Sub-SLS",
};
export type Region = {
  id: string;
  sourceCode: string;
  name: string;
  level: Level;
  parentId: string | null;
  childIds: string[];
  ancestors: string[];
  path: string;
  bbox: [number, number, number, number];
  geometryRef: string;
  qualityFlags: string[];
  aliases: string[];
};
export type Regions = Record<string, Region>;
export const rootId = "kabupaten:5202";
export function viewFromHash(hash: string, regions: Regions) {
  const [path, query] = hash.replace(/^#/, "").split("?");
  const p = new URLSearchParams(query);
  let id: string;
  try {
    id = decodeURIComponent(path?.replace("/wilayah/", "") || rootId);
  } catch {
    id = "invalid-uri";
  }
  const requested = p.get("batas") || "auto";
  const active = regions[id] || regions[rootId];
  const mode =
    requested !== "auto" &&
    levels.indexOf(requested as Level) < levels.indexOf(active.level)
      ? "auto"
      : requested;
  return {
    id: regions[id] ? id : rootId,
    invalid: !regions[id],
    mode: mode === "auto" || levels.includes(mode as Level) ? mode : "auto",
    labels: p.get("label") !== "0",
  };
}
export function displayed(regions: Regions, active: Region, mode: string) {
  if (mode === "auto")
    return active.childIds.length
      ? active.childIds.map((id) => regions[id])
      : [active];
  return Object.values(regions).filter(
    (r) => r.level === mode && r.ancestors.includes(active.id),
  );
}
export function search(regions: Regions, query: string, scope?: string) {
  const q = query.trim().toLocaleLowerCase("id").replace(/\s+/g, " ");
  const score = (r: Region) =>
    r.sourceCode === q
      ? 0
      : r.name.toLowerCase() === q
        ? 1
        : r.name.toLowerCase().startsWith(q)
          ? 2
          : 3;
  return Object.values(regions)
    .filter(
      (r) =>
        (!scope || r.ancestors.includes(scope)) &&
        (r.name.toLowerCase().includes(q) ||
          r.sourceCode.includes(q) ||
          r.aliases.some((a) => a.toLowerCase().includes(q))),
    )
    .sort((a, b) => score(a) - score(b) || a.path.localeCompare(b.path, "id"));
}
export function toggleSelection(
  ids: string[],
  region: Region,
  regions: Regions,
) {
  if (ids.includes(region.id)) return ids.filter((id) => id !== region.id);
  if (ids.length && regions[ids[0]].level !== region.level)
    throw Error(
      "Pilih wilayah pada level yang sama. Hapus pilihan sebelumnya untuk mengganti level.",
    );
  return [...ids, region.id];
}
