import { layoutLabels } from "../src/labelLayout";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  viewFromHash,
  displayed,
  search,
  toggleSelection,
  rootId,
  type Regions,
} from "../src/model";
import { validateSize } from "../src/export";
const m = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
const regions: Regions = JSON.parse(readFileSync("public" + m.regions, "utf8"));
describe("real dataset contract", () => {
  it("preserves anomalies and no false 00 sub-SLS", () => {
    expect(regions["desa:52020300016"].qualityFlags).toContain(
      "nonstandard-source-code",
    );
    expect(regions["sls:52020300141001"].aliases).toHaveLength(2);
    expect(regions["sls:52020300141001"].childIds).toHaveLength(0);
    expect(
      Object.values(regions)
        .filter((r) => r.level === "subsls")
        .every((r) => !r.sourceCode.endsWith("00")),
    ).toBe(true);
  });
  it("all parents and ancestors resolve", () => {
    for (const r of Object.values(regions)) {
      if (r.parentId) expect(regions[r.parentId].childIds).toContain(r.id);
      expect(r.ancestors[0]).toBe(rootId);
    }
  });
  it("auto level, leaf fallback, manual subtree", () => {
    expect(displayed(regions, regions[rootId], "auto")).toHaveLength(12);
    const leaf = Object.values(regions).find(
      (r) => r.level === "sls" && !r.childIds.length,
    )!;
    expect(displayed(regions, leaf, "auto")).toEqual([leaf]);
    expect(displayed(regions, regions[rootId], "desa")).toHaveLength(169);
  });
  it("search ranks exact code and respects scope", () => {
    const r = regions["desa:52020300016"];
    expect(search(regions, r.sourceCode)[0].id).toBe(r.id);
    expect(
      search(regions, "a", "kecamatan:5202050").every((r) =>
        r.ancestors.includes("kecamatan:5202050"),
      ),
    ).toBe(true);
  });
  it("rejects cross-level selections without losing existing choices", () => {
    const a = regions[rootId],
      b = Object.values(regions).find((r) => r.level === "desa")!;
    expect(() => toggleSelection([a.id], b, regions)).toThrow();
    expect(toggleSelection([a.id], a, regions)).toEqual([]);
  });
  it("normalizes unknown routes and query settings", () => {
    expect(viewFromHash("#/wilayah/%ZZ", regions).invalid).toBe(true);
    expect(
      viewFromHash("#/wilayah/missing?batas=garbage", regions),
    ).toMatchObject({ id: rootId, invalid: true, mode: "auto" });
    expect(
      viewFromHash("#/wilayah/desa%3A52020300016?label=0", regions).labels,
    ).toBe(false);
  });
  it("guards canvas allocation", () => {
    expect(() => validateSize(4096, 4096)).toThrow();
    expect(() => validateSize(1600, 1000)).not.toThrow();
  });
});

describe("adaptive screen-space labels", () => {
  it("reveals labels as projected space grows without a count cutoff", () => {
    const base = {
      name: "Dusun",
      x: 80,
      y: 80,
      width: 60,
      height: 16,
      availableWidth: 20,
      availableHeight: 10,
    };
    expect(layoutLabels([{ ...base, id: "a" }], 1000, 1000)).toHaveLength(0);
    expect(
      layoutLabels(
        [{ ...base, id: "a", availableWidth: 100, availableHeight: 40 }],
        1000,
        1000,
      ),
    ).toHaveLength(1);
    const many = Array.from({ length: 50 }, (_, i) => ({
      ...base,
      id: String(i),
      x: 60 + (i % 10) * 90,
      y: 40 + Math.floor(i / 10) * 60,
      availableWidth: 100,
      availableHeight: 40,
    }));
    expect(layoutLabels(many, 1000, 1000)).toHaveLength(50);
  });
  it("only accepted, in-viewport labels reserve collision space", () => {
    const a = {
      id: "a",
      name: "A",
      x: 50,
      y: 50,
      width: 60,
      height: 20,
      availableWidth: 100,
      availableHeight: 30,
    };
    expect(
      layoutLabels(
        [
          a,
          { ...a, id: "b", x: 55 },
          { ...a, id: "c", x: 125 },
          { ...a, id: "off", x: -30 },
        ],
        300,
        200,
      ).map((x) => x.id),
    ).toEqual(["a", "c"]);
  });
});
