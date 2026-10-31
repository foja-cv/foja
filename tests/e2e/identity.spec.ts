import { expect, previewMarkup, startExample, test } from "./fixtures";

test("a style is picked, copied into Typst and edited", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  const before = await previewMarkup(page);
  await page.locator('[data-style="banda"]').click();
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  // Banda has no sidebar options.
  await expect(page.getByLabel("Columnas")).toHaveCount(0);

  await page.getByRole("button", { name: "Editar en Typst" }).click();
  const code = page.getByLabel("Código Typst");
  await expect(code).toHaveValue(/#import "\/lib.typ": \*/);
  await expect(page.getByRole("navigation").getByRole("button", { name: /Banda \(mío\)/ })).toBeVisible();

  // A change in the code reaches the preview.
  const banded = await previewMarkup(page);
  await code.fill((await code.inputValue()).replace('#let band = 36mm', "#let band = 60mm"));
  await expect.poll(() => previewMarkup(page)).not.toBe(banded);

  // A Typst error keeps the last good render and says what is wrong.
  const good = await previewMarkup(page);
  await code.fill((await code.inputValue()) + "\n#cv.nonexistent");
  await expect(page.getByRole("alert").filter({ hasText: "Typst no pudo compilar" })).toBeVisible();
  expect(await previewMarkup(page)).toBe(good);

  // In use, it cannot be deleted.
  await expect(page.getByRole("button", { name: "Borrar estilo" })).toBeDisabled();
});

test("a style from scratch compiles and can be used by another profile", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  await page.getByRole("button", { name: "Nuevo estilo desde cero" }).click();
  await expect(page.getByLabel("Código Typst")).toHaveValue(/A CV style of your own/);
  await expect(page.getByTestId("page-badge")).toContainText("1 página");
  await page.getByLabel("Perfil", { exact: true }).selectOption("docente");
  await page.getByRole("navigation").getByRole("button", { name: /Estilo nuevo/ }).click();
  await page.getByRole("button", { name: "Usar en este perfil" }).click();
  await expect(page.getByText("En uso en este perfil")).toBeVisible();
});

test("themes: built-in, mode, imported and the plugin API", async ({ page }) => {
  await startExample(page);
  const root = () => page.evaluate(() => ({ theme: document.documentElement.dataset.theme, mode: document.documentElement.dataset.mode }));
  expect((await root()).theme).toBe("papel");

  await page.getByRole("button", { name: /Apariencia/ }).click();
  await page.getByRole("radio", { name: "Vivo" }).check();
  await expect.poll(async () => (await root()).theme).toBe("viva");
  await page.getByRole("dialog", { name: "Apariencia" }).getByLabel("Modo").selectOption("dark");
  await expect.poll(async () => (await root()).mode).toBe("dark");

  // An imported theme is validated: no url(), only colours.
  const input = page.getByText("Importar un tema (.json)…").locator("input");
  const bad = { id: "malo", name: "Malo", light: { bg: "url(https://example.com/x)" } };
  await input.setInputFiles({ name: "malo.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.getByRole("alert")).toContainText('"light.bg" is not a colour');
  const good = { id: "bosque", name: "Bosque", light: { accent: "#2d6a4f", bg: "#f1f7f3" } };
  await input.setInputFiles({ name: "bosque.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(good)) });
  await expect.poll(async () => (await root()).theme).toBe("bosque");
  await expect(page.getByRole("radio", { name: "Bosque" })).toBeChecked();

  // The same through the plugin API, and it survives a reload.
  await page.evaluate(() => (window as any).foja.themes.register({ id: "noche", name: "Noche", light: { accent: "#7048e8" }, dark: { accent: "#b197fc" } }));
  await page.evaluate(() => (window as any).foja.themes.use("noche"));
  await expect.poll(async () => (await root()).theme).toBe("noche");
  await page.reload();
  await expect.poll(async () => (await root()).theme).toBe("noche");
  expect(await page.evaluate(() => (window as any).foja.themes.list().map((t: { id: string }) => t.id))).toEqual(["papel", "neutra", "viva", "bosque", "noche"]);
});

test("the interface speaks English too, and remembers it", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: /Apariencia/ }).click();
  await page.getByLabel("Idioma de la interfaz").selectOption("en");
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Style and layout" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Profile text" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
});
