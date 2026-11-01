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
  await page.getByLabel("Warna batas dan isian").fill("#327455");
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
        await page.mouse.click(x, y);
        await expect(page.locator(".context-main h1")).toHaveText(name);
        found = true;
      }
    }
  expect(found).toBeTruthy();
});
