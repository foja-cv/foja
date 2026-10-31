import { readFileSync } from "node:fs";
import { expect, previewMarkup, startExample, test } from "./fixtures";

const example = JSON.parse(readFileSync("examples/example.project.json", "utf8"));

test("selecting a part highlights it, clicking the preview selects it", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: "Banco de entradas" }).click();
  await page.getByRole("button", { name: /Pasante de desarrollo/ }).click();
  const box = page.getByTestId("highlight-box").first();
  await expect(box).toBeVisible();
  const where = (await box.boundingBox())!;

  await page.getByRole("button", { name: "Diseño" }).click();
  await expect(page.getByTestId("highlight-box")).toHaveCount(0);
  await page.mouse.click(where.x + where.width / 2, where.y + where.height / 2);
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Pasante de desarrollo");

  // The sidebar is its own column: a click there selects a sidebar part.
  const summary = page.getByRole("button", { name: "Texto del perfil" });
  await summary.click();
  await page.getByRole("button", { name: /Fortalezas/ }).click();
  const side = (await page.getByTestId("highlight-box").first().boundingBox())!;
  await page.getByRole("button", { name: "Contactos" }).click();
  await page.mouse.click(side.x + side.width / 2, side.y + 5);
  await expect(page.getByLabel("Título de la sección")).toHaveValue("Fortalezas");
});

test("a CV that does not fit says by how much and what overflows", async ({ page }) => {
  const long = structuredClone(example);
  const exp = long.profiles.desarrolladora.sections[0];
  exp.blocks = Array.from({ length: 6 }, () => exp.blocks).flat();
  await page.goto("/editor");
  await page.getByText("Importar JSON").locator("input").setInputFiles({ name: "long.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(long)) });
  await expect(page.getByTestId("page-badge")).toContainText(/2 páginas ⚠ se pasa ~\d+ líneas/);
  await expect(page.getByTestId("overflow-box").first()).toBeVisible();
  await expect(page.getByRole("navigation").getByTitle("se pasa de una página").first()).toBeVisible();
});

test("sections reorder by keyboard drag and drop", async ({ page }) => {
  await startExample(page);
  const nav = page.getByRole("navigation");
  const titles = () => nav.locator("li button:not([aria-label])").allInnerTexts();
  const before = await titles();
  const handle = nav.getByRole("button", { name: "Arrastrar para reordenar" }).first();
  await handle.focus();
  // dnd-kit measures between animation frames: give it a moment between keys.
  for (const key of ["Space", "ArrowDown", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }
  await expect.poll(titles).not.toEqual(before);
  const after = await titles();
  expect(after.indexOf("Experiencia")).toBeGreaterThan(after.indexOf("Formación"));
});

test("the command palette goes anywhere", async ({ page }) => {
  await startExample(page);
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Ir a/).fill("diseno");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Columnas")).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Ir a/).fill("entrada licenciatura");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Licenciatura en Ciencias de la Computación");
});

test("a photo is cropped and goes into the CV", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: "Personales" }).click();
  const before = await previewMarkup(page);
  // A 40×30 PNG made in the page.
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 30;
    const g = c.getContext("2d")!;
    g.fillStyle = "#336699";
    g.fillRect(0, 0, 40, 30);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByLabel("Foto").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: Buffer.from(png) });
  await expect(page.getByTestId("crop-frame")).toBeVisible();
  await page.getByRole("button", { name: "Usar esta foto" }).click();
  await expect(page.getByRole("button", { name: "Quitar foto" })).toBeVisible();
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  expect(await previewMarkup(page)).toContain("data:image/jpeg");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 400, height: 800 }, isMobile: true, hasTouch: true });

  test("one pane at a time, nothing wider than the screen", async ({ page }) => {
    await startExample(page);
    const panes = page.getByRole("navigation", { name: "Paneles" });
    await expect(page.getByLabel("Subtítulo")).toBeVisible();
    await panes.getByRole("button", { name: "Vista previa" }).click();
    await expect(page.locator(".foja-page svg")).toBeVisible();
    await expect(page.getByLabel("Subtítulo")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panes.getByRole("button", { name: "Secciones" }).click();
    await page.getByRole("button", { name: "Banco de entradas" }).click();
    await expect(page.getByRole("button", { name: "Nueva entrada" })).toBeVisible();
    await page.getByRole("button", { name: "Más acciones" }).click();
    await expect(page.getByRole("button", { name: "+ Nuevo perfil" })).toBeVisible();
  });
});
