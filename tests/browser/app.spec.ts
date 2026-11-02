import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
test("search-first navigation, map rendering, settings and secondary export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Simulate unavailable external basemap: local boundaries must still work.
  let osm = 0;
  await page.route("https://tile.openstreetmap.org/**", (r) => {
    osm++;
    return r.abort();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Lombok Tengah", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("Bebuaq");
  await page.locator(".search-result").first().click();
  await expect(
    page.getByRole("heading", { name: "Bebuaq", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".search-results")).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Lombok Tengah", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await page
    .getByRole("button", { name: "Pengaturan peta", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Peta dasar" }).selectOption("none");
  await page.getByLabel("Warna berbeda setiap wilayah").check();
  await page.getByLabel("Warna garis", { exact: true }).fill("#327455");
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("Praya");
  await page.getByRole("button", { name: "Reset pencarian" }).click();
  await expect(
    page.getByRole("textbox", { name: "Cari nama atau kode wilayah" }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Unduh peta wilayah aktif" }).click();
  await page.getByRole("button", { name: "Buat pratinjau" }).click();
  await expect(
    page.getByAltText("Pratinjau gambar batas wilayah"),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh PNG" }).click();
  await (await download).saveAs("test-results/map.png");
  expect(readFileSync("test-results/map.png").readUInt32BE(16)).toBe(1600);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/desktop.png" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: "test-results/mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
  expect(osm).toBeGreaterThan(0);
});
test("search hierarchy, empty state, accessibility and invalid routes", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/#/wilayah/missing");
  await expect(
    page.getByRole("heading", { name: "Lombok Tengah", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("52020300141001");
  await page.locator(".search-result").first().click();
  await page.getByText("Data perlu pemeriksaan").click();
  await expect(
    page.getByText("Satu kode dipakai beberapa nama.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("zzzzzz");
  await expect(
    page.getByText("Tidak ada wilayah yang cocok.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset pencarian" }).click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});
test("hover identifies hierarchy and clicking drills into polygon", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/");
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  let found = false;
  for (let y = 220; y < 700 && !found; y += 90)
    for (let x = 530; x < 1100 && !found; x += 90) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(50);
      if (await page.locator(".hover-card").isVisible()) {
        const name = await page.locator(".hover-card h2").innerText();
        await expect(page.locator(".hover-card")).toContainText(
          "wilayah di bawahnya",
        );
        const tip = await page.locator(".hover-card").boundingBox();
        expect(
          Math.min(Math.abs(tip!.x - x), Math.abs(tip!.x + tip!.width - x)),
        ).toBeLessThan(40);
        expect(tip!.y + tip!.height).toBeLessThanOrEqual(960);
        await page.screenshot({ path: "test-results/hover.png" });
        await page.mouse.click(x, y);
        await expect(page.locator(".context-main h1")).toHaveText(name);
        found = true;
      }
    }
  expect(found).toBeTruthy();
});
test("map style controls, wheel scrolling, backdrop dismissal and search focus", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator(".context-main h1")).toBeVisible();
  const search = await page.locator(".searchbox").boundingBox(),
    context = await page.locator(".context-panel").boundingBox();
  expect(context!.y).toBeGreaterThan(search!.y + search!.height);
  expect(Math.abs(context!.x - search!.x)).toBeLessThan(2);
  await page
    .getByRole("button", { name: "Pengaturan peta", exact: true })
    .click();
  await page.getByLabel("Warna garis", { exact: true }).fill("#123456");
  await page.getByLabel("Ketebalan garis batas", { exact: true }).fill("4");
  const body = page.locator(".dialog-body");
  const rect = await body.boundingBox();
  await page.mouse.move(rect!.x + 100, rect!.y + 100);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => body.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await page.getByLabel("Ukuran label", { exact: true }).fill("16");
  await page.getByLabel("Warna label", { exact: true }).fill("#223344");
  await page.getByLabel("Teks tebal", { exact: true }).uncheck();
  await page.getByLabel("Latar label", { exact: true }).check();
  await page.getByLabel("Warna latar label", { exact: true }).fill("#eeeeee");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.mouse.click(10, 400);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const label = page.locator(".map-labels span").first();
  await expect(label).toHaveCSS("font-size", "16px");
  await expect(label).toHaveCSS("color", "rgb(34, 51, 68)");
  await expect(label).toHaveCSS("font-weight", "400");
  await expect(label).toHaveCSS("background-color", "rgb(238, 238, 238)");
  await page.getByRole("button", { name: "Tentang data", exact: true }).click();
  await page.mouse.click(10, 400);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .focus();
  await expect(
    page.getByRole("textbox", { name: "Cari nama atau kode wilayah" }),
  ).toHaveCSS("outline-style", "none");
  await page.setViewportSize({ width: 360, height: 800 });
  await page
    .getByRole("button", { name: "Pengaturan peta", exact: true })
    .click();
  const mobileBody = await body.boundingBox();
  await page.mouse.move(mobileBody!.x + 40, mobileBody!.y + 80);
  await page.mouse.wheel(0, -2000);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => body.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/settings-mobile.png" });
});
test("SLS labels respond to zoom while county context stays active", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/#/wilayah/kabupaten%3A5202?batas=sls");
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  const before = await page
    .locator(".map-labels span")
    .evaluateAll((es) => es.map((e) => e.getAttribute("data-region-id")));
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Perbesar", exact: true }).click();
    await page.waitForTimeout(350);
  }
  await expect
    .poll(async () => {
      const after = await page
        .locator(".map-labels span")
        .evaluateAll((es) => es.map((e) => e.getAttribute("data-region-id")));
      return after.filter((id) => !before.includes(id)).length;
    })
    .toBeGreaterThan(0);
  await expect(page.locator(".context-main h1")).toHaveText("Lombok Tengah");
  expect(page.url()).toContain("batas=sls");
  const boxes = await page.locator(".map-labels span").evaluateAll((es) =>
    es.map((e) => {
      const b = e.getBoundingClientRect();
      return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
    }),
  );
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      expect(
        a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y,
      ).toBe(false);
    }
  await expect(
    page.getByText("Klik batas untuk menjelajah lebih dalam"),
  ).toHaveCount(0);
  expect(
    (await page.locator(".context-panel").boundingBox())!.height,
  ).toBeLessThan(170);
  await page.screenshot({ path: "test-results/adaptive-labels.png" });
});
test("right-drag cannot rotate or tilt the map while left-drag still pans", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/");
  await expect
    .poll(() => page.locator(".map-labels span").count())
    .toBeGreaterThan(0);
  await page.waitForTimeout(650);
  const positions = () =>
    page.locator(".map-labels span").evaluateAll((es) =>
      es.map((e) => ({
        id: e.getAttribute("data-region-id"),
        x: (e as HTMLElement).style.left,
        y: (e as HTMLElement).style.top,
      })),
    );
  const before = await positions();
  await page.mouse.move(1000, 500);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(1200, 650, { steps: 12 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(300);
  expect(await positions()).toEqual(before);
  await page.locator("canvas.maplibregl-canvas").focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowUp");
  await page.waitForTimeout(300);
  expect(await positions()).toEqual(before);
  await page.mouse.move(1000, 500);
  await page.mouse.down();
  await page.mouse.move(1100, 540, { steps: 12 });
  await page.mouse.up();
  await expect.poll(positions).not.toEqual(before);
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Unduh peta wilayah aktif" }).focus();
  await expect(
    page.getByRole("button", { name: "Unduh peta wilayah aktif" }),
  ).toHaveCSS("outline-color", "rgb(22, 90, 67)");
});
test("map boundary request failure is identified and retry recovers", async ({
  page,
}) => {
  let failing = true;
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.route("**/*.pmtiles", (r) =>
    failing
      ? r.fulfill({ status: 503, body: "Temporarily unavailable" })
      : r.continue(),
  );
  await page.goto("/");
  await expect(
    page.getByText("Batas wilayah gagal dimuat.", { exact: false }),
  ).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByText("Batas wilayah gagal dimuat.", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Lombok Tengah", exact: true }),
  ).toBeVisible();
});
test("a failed outline from the previous region cannot leave a stale warning", async ({
  page,
}) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.route("**/detail-overview.json", async (r) => {
    await wait;
    await r.fulfill({ status: 503, body: "Unavailable" }).catch(() => {});
  });
  await page.goto("/");
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("Kopang");
  await page.locator(".search-result").first().click();
  await expect(page.locator(".context-main h1")).toHaveText("Kopang");
  release();
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByText("Outline wilayah gagal dimuat.", { exact: false }),
  ).toHaveCount(0);
});
test("one-off range failures recover automatically during zoom", async ({
  page,
}) => {
  let failNext = true,
    failures = 0;
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.route("**/*.pmtiles", (r) => {
    if (failNext) {
      failNext = false;
      failures++;
      return r.fulfill({ status: 503, body: "busy" });
    }
    return r.continue();
  });
  await page.goto("/");
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  failNext = true;
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Perbesar", exact: true }).click();
  await expect.poll(() => failures).toBe(2);
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByText("Batas wilayah gagal dimuat.", { exact: false }),
  ).toHaveCount(0);
});
test("dismissed map alert stays closed during the same failing tile incident", async ({
  page,
}) => {
  let failing = false,
    failures = 0;
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.route("**/*.pmtiles", (r) => {
    if (failing) {
      failures++;
      return r.fulfill({ status: 503, body: "busy" });
    }
    return r.continue();
  });
  await page.goto("/");
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  failing = true;
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Perbesar", exact: true }).click();
  await expect(
    page.getByText("Batas wilayah gagal dimuat.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tutup peringatan peta" }).click();
  await expect(page.locator(".map-error")).toHaveCount(0);
  const count = failures;
  await page.getByRole("button", { name: "Perbesar", exact: true }).click();
  await expect.poll(() => failures).toBeGreaterThan(count);
  await page.waitForTimeout(1200);
  await expect(page.locator(".map-error")).toHaveCount(0);
  await expect(page.locator(".context-main h1")).toHaveText("Lombok Tengah");
});
test("HTTP 200 without byte serving still renders boundaries through one full download", async ({
  page,
}) => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(
    await readFile("public/data/manifest.json", "utf8"),
  );
  const archive = await readFile("public" + manifest.tiles);
  let full = 0;
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.route("**/*.pmtiles", async (r) => {
    if (!r.request().headers()["range"]) full++;
    await r.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      body: archive,
    });
  });
  await page.goto("/");
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Perbesar", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("Bebuaq");
  await page.locator(".search-result").first().click();
  await expect(page.locator(".context-main h1")).toHaveText("Bebuaq");
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByText("Batas wilayah gagal dimuat.", { exact: false }),
  ).toHaveCount(0);
  expect(full).toBe(1);
});
test("context follows search with full hierarchy and download lives in map controls", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator(".context-main h1")).toHaveText("Lombok Tengah");
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("Aik Dareq");
  await page.locator(".search-result").first().click();
  await expect(page.locator(".context-main h1")).toHaveText("Aik Dareq");
  const breadcrumb = page.getByRole("navigation", { name: "Hierarki wilayah" });
  await expect(breadcrumb).toContainText("Lombok Tengah");
  await expect(breadcrumb).toContainText("Batukliang");
  await expect(breadcrumb).toContainText("Aik Dareq");
  await expect(
    page
      .locator(".context-panel")
      .getByRole("button", { name: "Unduh peta wilayah aktif" }),
  ).toHaveCount(0);
  const controls = page.getByRole("group", { name: "Kontrol peta" });
  await expect(controls.getByRole("button")).toHaveCount(4);
  await expect(controls.locator("svg")).toHaveCount(4);
  await controls
    .getByRole("button", { name: "Unduh peta wilayah aktif" })
    .click();
  await expect(page.getByRole("dialog", { name: "Ekspor peta" })).toBeVisible();
  await expect(page.locator(".selection-list")).toContainText("Aik Dareq");
  await page.keyboard.press("Escape");
  await page.locator(".child-count").click();
  await expect(page.locator(".search-result").first()).toBeVisible();
  await page.getByRole("button", { name: "Reset pencarian" }).click();
  await breadcrumb
    .getByRole("link", { name: "Batukliang", exact: true })
    .click();
  await expect(page.locator(".context-main h1")).toHaveText("Batukliang");
  for (const width of [1440, 360, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const search = await page.locator(".searchbox").boundingBox(),
      context = await page.locator(".context-panel").boundingBox();
    expect(context!.y).toBeGreaterThanOrEqual(search!.y + search!.height);
    expect(Math.abs(context!.x - search!.x)).toBeLessThan(2);
    const toolbar = await controls.boundingBox(),
      brand = await page.locator(".explore-brand").boundingBox();
    expect(toolbar!.x).toBeGreaterThanOrEqual(brand!.x + brand!.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 900)
      await expect
        .poll(async () => {
          const c = await page
            .locator(".maplibregl-ctrl-top-right")
            .boundingBox();
          return c!.y;
        })
        .toBeGreaterThan(context!.y + context!.height);
    if (width === 1440)
      await page.screenshot({
        path: "test-results/context-toolbar-desktop.png",
      });
  }
  await page.screenshot({ path: "test-results/context-toolbar-mobile.png" });
});
