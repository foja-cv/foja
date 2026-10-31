import { expect, test } from "./fixtures";

const url = process.env.PWA_URL;

test.describe("production build", () => {
  test.skip(!url, "run through scripts/e2e-pwa.sh");

  test("the landing page links to the editor under the base path", async ({ page, errors }) => {
    await page.goto(url!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu CV en Typst, sin escribir código");
    await page.getByRole("link", { name: "Abrir el editor" }).click();
    await expect(page).toHaveURL(`${url}editor/`);
    await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
    await expect(page.locator(".foja-page svg")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("under the Content Security Policy the editor compiles and exports", async ({ page, errors }) => {
    const violations: string[] = [];
    page.on("console", (m) => /Content.Security.Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    await page.goto(`${url}editor/`);
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")).toContain("connect-src 'self' data:");
    await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
    await expect(page.getByTestId("page-badge")).toContainText("1 página");
    for (const label of ["PDF", "JPG (una imagen por página)", "Todos los formatos (.zip)"]) {
      await page.getByRole("button", { name: "Exportar", exact: true }).click();
      await page.getByLabel(label).check();
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar" }).click()]);
      expect(download.suggestedFilename()).toMatch(/^lucia-romero-desarrolladora\./);
    }
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("the manifest is installable", async ({ page }) => {
    const response = await page.request.get(`${url}manifest.webmanifest`);
    const manifest = await response.json();
    expect(manifest.start_url).toBe("./editor/");
    for (const icon of manifest.icons) expect((await page.request.get(new URL(icon.src, `${url}manifest.webmanifest`).href)).ok()).toBe(true);
  });

  test("after the first visit the editor works offline", async ({ page, context }) => {
    await page.goto(`${url}editor/`);
    // Wait for the service worker to install (it precaches the whole site, compiler included).
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith("foja-")))).toBe(true);
    await expect
      .poll(async () => page.evaluate(async () => (await (await caches.open((await caches.keys()).find((k) => k.startsWith("foja-"))!)).keys()).length), { timeout: 60_000 })
      .toBeGreaterThan(20);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
    await expect(page.locator(".foja-page svg")).toBeVisible();
    await expect(page.getByTestId("page-badge")).toContainText("1 página");
    await context.setOffline(false);
  });
});
