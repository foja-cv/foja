import { readFileSync } from "node:fs";
import { expect, previewMarkup, startExample, test } from "./fixtures";

test("the example renders on one page", async ({ page, errors }) => {
  await startExample(page);
  await expect(page.getByTestId("page-badge")).toContainText("1 página");
  expect(errors).toEqual([]);
});

test("editing updates the preview, saves and survives a reload", async ({ page }) => {
  await startExample(page);
  const before = await previewMarkup(page);
  const subtitle = page.getByLabel("Subtítulo");
  await subtitle.fill("Ingeniera de software");
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  await expect(page.getByTestId("save-state")).toHaveText("Guardado");
  await page.reload();
  await expect(page.getByLabel("Subtítulo")).toHaveValue("Ingeniera de software");
});

test("undo and redo", async ({ page }) => {
  await startExample(page);
  const subtitle = page.getByLabel("Subtítulo");
  await subtitle.fill("Otro puesto");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Control+z");
  await expect(subtitle).toHaveValue("Desarrolladora full stack");
  await page.keyboard.press("Control+Shift+z");
  await expect(subtitle).toHaveValue("Otro puesto");
});

test("an entry edited once changes in every profile that uses it", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: "Banco de entradas" }).click();
  await page.getByRole("button", { name: /Desarrolladora full stack/ }).click();
  await expect(page.getByText(/La usan los perfiles: Desarrolladora, Docente/)).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill("Desarrolladora sénior");
  await page.getByLabel("Perfil", { exact: true }).selectOption("docente");
  await page.getByRole("button", { name: /Experiencia profesional/ }).click();
  await expect(page.getByRole("button", { name: "Desarrolladora sénior" })).toBeVisible();
});

test("layout options reach the preview", async ({ page }) => {
  await startExample(page);
  const before = await previewMarkup(page);
  await page.getByRole("button", { name: "Diseño" }).click();
  await page.getByLabel("Columnas").selectOption("1");
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  await expect(page.getByTestId("page-badge")).toBeVisible();
});

for (const [label, ext, magic] of [
  ["PDF", ".pdf", "%PDF-"],
  ["Word (.docx)", ".docx", "PK"],
  ["Todos los formatos (.zip)", ".zip", "PK"],
  ["Markdown", ".md", "# Lucía Romero"],
  ["JPG (una imagen por página)", ".jpg", "\xff\xd8"],
] as const) {
  test(`export ${label}`, async ({ page, errors }) => {
    await startExample(page);
    await page.getByRole("button", { name: "Exportar" }).click();
    await page.getByLabel(label).check();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar" }).click()]);
    expect(download.suggestedFilename()).toBe(`lucia-romero-desarrolladora${ext}`);
    const data = readFileSync((await download.path())!);
    const expected = Buffer.from(magic, ext === ".md" ? "utf8" : "latin1");
    expect(data.subarray(0, expected.length).equals(expected)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("importing something that is not a project explains why", async ({ page }) => {
  await page.goto("/editor");
  await page.getByText("Importar JSON").locator("input").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"format":"foja/2"}') });
  await expect(page.getByRole("alert")).toContainText('missing "person"');
});

test("markup in the text never reaches the page as HTML", async ({ page }) => {
  await startExample(page);
  const before = await previewMarkup(page);
  await page.getByLabel("Subtítulo").fill('<img src=x onerror="window.__xss=1"><b>hola</b>');
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  expect(await page.locator(".foja-page img, .foja-page b, .foja-page foreignObject").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});
