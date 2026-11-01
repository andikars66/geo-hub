import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("real map, hierarchy, history, export, and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const ranges: number[] = [];
  page.on("response", (r) => {
    if (r.url().includes(".pmtiles")) ranges.push(r.status());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Lombok Tengah", exact: true }),
  ).toBeVisible();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.locator(".map-canvas").getAttribute("data-features")),
    )
    .toBeGreaterThan(0);
  expect(
    (await page.locator("canvas.maplibregl-canvas").boundingBox())!.height,
  ).toBeGreaterThan(200);
  await page.screenshot({ path: "test-results/desktop.png" });
  await page.locator(".region-link").filter({ hasText: "Kopang" }).click();
  await expect(
    page.getByRole("heading", { name: "Kopang", exact: true }),
  ).toBeVisible();
  await page.locator(".region-link").filter({ hasText: "Bebuaq" }).click();
  await expect(
    page.getByRole("heading", { name: "Bebuaq", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Kopang", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await page
    .getByRole("button", { name: "Pilih wilayah ini", exact: true })
    .click();
  await page.getByRole("button", { name: /Ekspor peta/ }).click();
  await page.getByRole("button", { name: "Buat pratinjau" }).click();
  await expect(page.getByAltText("Pratinjau gambar batas wilayah")).toBeVisible(
    { timeout: 30000 },
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh PNG" }).click();
  const file = await download;
  await file.saveAs("test-results/map.png");
  expect(file.suggestedFilename()).toContain(".png");
  const png = readFileSync("test-results/map.png");
  expect(png.toString("hex", 0, 8)).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBe(1600);
  expect(png.readUInt32BE(20)).toBe(1000);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Layer", exact: true }).click();
  await page.getByLabel("Level batas").selectOption("sls");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bebuaq", exact: true }),
  ).toBeVisible();
  expect(page.url()).toContain("batas=sls");
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("52020300141001");
  await page.locator(".region-link").first().click();
  await expect(
    page.getByText("Satu kode dipakai beberapa nama.", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: "test-results/mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
  expect(ranges).toContain(206);
});
test("unknown URLs, search scope, leaf, export validation, blocked storage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.goto("/#/wilayah/missing");
  await expect(
    page.getByRole("heading", { name: "Lombok Tengah", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "tidak dikenal" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("Jurit");
  await page.locator(".region-link").first().click();
  await expect(page.locator(".region-summary h1")).toContainText("Jurit");
  await page.getByRole("checkbox", { name: "Cari dalam wilayah ini" }).check();
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .fill("Kopang");
  await expect(
    page.getByText("Tidak ada wilayah yang cocok.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Cari nama atau kode wilayah" })
    .clear();
  await page
    .getByRole("button", { name: "Pilih wilayah ini", exact: true })
    .click();
  await page.getByRole("button", { name: /Ekspor peta/ }).click();
  await page.getByLabel("Lebar (px)").fill("4096");
  await page.getByLabel("Tinggi (px)").fill("4096");
  await page.getByRole("button", { name: "Buat pratinjau" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "maksimum 12 juta piksel" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset pengaturan" }).click();
  await page.getByRole("button", { name: "Buat pratinjau" }).click();
  await expect(
    page.getByAltText("Pratinjau gambar batas wilayah"),
  ).toBeVisible();
  await page.getByLabel("Judul", { exact: true }).fill("Peta baru");
  await expect(page.getByRole("button", { name: "Unduh PNG" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "Ringkas direktori" }).click();
  await expect(
    page.getByRole("button", { name: "Buka direktori" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Layer", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Layer", exact: true }),
  ).toBeFocused();
});

test("accessible page and native settings dialog", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  await expect(page.locator(".region-summary h1")).toBeVisible();
  const main = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(main.violations).toEqual([]);
  await page.getByRole("button", { name: "Layer", exact: true }).click();
  const dialog = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(dialog.violations).toEqual([]);
});
