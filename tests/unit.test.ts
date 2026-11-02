import { cameraPadding } from "../src/camera";
import { EtagMismatch } from "pmtiles";
import { ResilientMapSource } from "../src/mapSource";
import { layoutLabels } from "../src/labelLayout";
import { describe, it, expect, vi, afterEach } from "vitest";
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

describe("temporary PMTiles transport failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("retries temporary failures while preserving range and ETag", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 206,
          headers: { ETag: '"v1"', "Content-Range": "bytes 10-12/100" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const pending = new ResilientMapSource(
      "https://example.test/map.pmtiles",
    ).getBytes(10, 3, undefined, '"v1"');
    await vi.advanceTimersByTimeAsync(200);
    const result = await pending;
    expect(new Uint8Array(result.data)).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.etag).toBe('"v1"');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][1].headers.get("range")).toBe("bytes=10-12");
  });
  it("stops after two retries rather than looping", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    const pending = expect(
      new ResilientMapSource("https://example.test/map.pmtiles").getBytes(
        0,
        16,
      ),
    ).rejects.toThrow("Failed to fetch");
    await vi.advanceTimersByTimeAsync(800);
    await pending;
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("does not retry a missing file", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      new ResilientMapSource("https://example.test/map.pmtiles").getBytes(
        0,
        16,
      ),
    ).rejects.toThrow("404");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("cancels backoff when zoom/navigation aborts the request", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const pending = expect(
      new ResilientMapSource("https://example.test/map.pmtiles").getBytes(
        0,
        16,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await pending;
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("PMTiles full-archive fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const bytes = () => {
    const b = new Uint8Array(100);
    b.set(new TextEncoder().encode("PMTiles"));
    b.set([7, 8, 9], 20);
    return b;
  };
  it("shares a full GET after HTTP 200 ignores Range, with or without Content-Length", async () => {
    for (const lengthHeader of [true, false]) {
      let full = 0;
      const fetch = vi.fn(async (_url, options) => {
        if (!options.headers.has("Range")) full++;
        return new Response(bytes(), {
          status: 200,
          headers: {
            ETag: '"v1"',
            ...(lengthHeader ? { "Content-Length": "100" } : {}),
          },
        });
      });
      vi.stubGlobal("fetch", fetch);
      const source = new ResilientMapSource("https://example.test/map.pmtiles");
      const [a, b] = await Promise.all([
        source.getBytes(20, 3),
        source.getBytes(0, 7),
      ]);
      expect([...new Uint8Array(a.data)]).toEqual([7, 8, 9]);
      expect(new TextDecoder().decode(b.data)).toBe("PMTiles");
      await source.getBytes(20, 3);
      expect(full).toBe(1);
      expect(a.etag).toBe('"v1"');
      source.dispose();
    }
  });
  it("does not accept an HTML application fallback as an archive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("<html>wrong rewrite</html>", { status: 200 }),
      ),
    );
    await expect(
      new ResilientMapSource("https://example.test/map.pmtiles").getBytes(
        0,
        16,
      ),
    ).rejects.toThrow("not a PMTiles archive");
  });
  it("preserves ETag mismatch detection when switching to a full snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(bytes(), { status: 200, headers: { ETag: '"new"' } }),
      ),
    );
    const source = new ResilientMapSource("https://example.test/map.pmtiles");
    await expect(
      source.getBytes(20, 3, undefined, '"old"'),
    ).rejects.toBeInstanceOf(EtagMismatch);
    expect(new TextDecoder().decode((await source.getBytes(0, 7)).data)).toBe(
      "PMTiles",
    );
    source.dispose();
  });
  it("cancelling one tile does not cancel the shared full download", async () => {
    let finish!: (r: Response) => void;
    let full = 0;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => {
        if (options.headers.has("Range"))
          return new Response(bytes(), { status: 200 });
        full++;
        return pending;
      }),
    );
    const source = new ResilientMapSource("https://example.test/map.pmtiles"),
      controller = new AbortController();
    const cancelled = expect(
      source.getBytes(20, 3, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(full).toBe(1));
    const second = source.getBytes(20, 3);
    controller.abort();
    await cancelled;
    finish(new Response(bytes(), { status: 200 }));
    expect([...new Uint8Array((await second).data)]).toEqual([7, 8, 9]);
    expect(full).toBe(1);
    source.dispose();
  });
  it("rejects a mismatched Content-Range instead of decoding wrong bytes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 206,
            headers: { "Content-Range": "bytes 0-2/100" },
          }),
      ),
    );
    await expect(
      new ResilientMapSource("https://example.test/map.pmtiles").getBytes(
        20,
        3,
      ),
    ).rejects.toThrow("Invalid Content-Range");
  });
  it("caps streamed full downloads instead of trusting Content-Length", async () => {
    let cancelled = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) =>
        options.headers.has("Range")
          ? new Response("ignored", { status: 200 })
          : new Response(
              new ReadableStream({
                start(c) {
                  c.enqueue(new Uint8Array(32 * 1024 * 1024 + 1));
                },
                cancel() {
                  cancelled = true;
                },
              }),
              { status: 200 },
            ),
      ),
    );
    await expect(
      new ResilientMapSource("https://example.test/map.pmtiles").getBytes(
        0,
        16,
      ),
    ).rejects.toThrow("supported download size");
    expect(cancelled).toBe(true);
  });
  it("reports a full-download timeout as a real error rather than navigation cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => {
        if (options.headers.has("Range"))
          return new Response("ignored", { status: 200 });
        return new Promise<Response>((_resolve, reject) =>
          options.signal.addEventListener(
            "abort",
            () => reject(new DOMException("timeout", "AbortError")),
            { once: true },
          ),
        );
      }),
    );
    const pending = expect(
      new ResilientMapSource("https://example.test/map.pmtiles").getBytes(
        0,
        16,
      ),
    ).rejects.toThrow("download timed out");
    await vi.advanceTimersByTimeAsync(30000);
    await pending;
  });
});

describe("camera framing below the search context", () => {
  it("leaves the search/context clear and shifts mobile framing down", () => {
    const padding = cameraPadding(360, 800, 200);
    expect(padding.top).toBe(228);
    expect(padding.top).toBeGreaterThan(padding.bottom);
    expect(padding.right).toBeGreaterThan(padding.left);
  });
  it("adapts to context height and clamps padding on short screens", () => {
    expect(cameraPadding(360, 800, 260).top).toBe(288);
    const p = cameraPadding(320, 360, 300);
    expect(p.top + p.bottom).toBeLessThan(360);
    expect(cameraPadding(1440, 960, 140).top).toBeGreaterThan(140);
  });
});
