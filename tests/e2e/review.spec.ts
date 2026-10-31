import { expect, startExample, test } from "./fixtures";

test("every control of every panel has an accessible name", async ({ page }) => {
  await startExample(page);
  const panels = ["Personales", "Contactos", "Habilidades", "Banco de entradas", "Texto del perfil", "Estilo y diseño", "Experiencia", "Fortalezas"];
  for (const panel of panels) {
    await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: new RegExp(panel) }).first().click();
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll("main input, main select, main textarea, main button")]
        .filter((el) => {
          const e = el as HTMLInputElement;
          if (e.type === "hidden" || e.closest(".sr-only")) return false;
          const named = e.getAttribute("aria-label") || (e.labels && e.labels.length) || e.textContent?.trim() || e.getAttribute("title");
          return !named;
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    );
    expect(unnamed, panel).toEqual([]);
  }
});

test("names are typed with spaces", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: "Personales" }).click();
  const given = page.getByLabel("Nombres");
  await given.fill("");
  await given.pressSequentially("Ana María", { delay: 20 });
  await expect(given).toHaveValue("Ana María");
});

test("a project replaced by a new one can be restored", async ({ page }) => {
  await startExample(page);
  await page.getByLabel("Subtítulo").fill("Mi subtítulo único");
  await page.getByRole("button", { name: "Proyecto ▾" }).click();
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await expect(page.getByLabel("Subtítulo")).toHaveValue("Puesto que buscás");
  await page.getByRole("button", { name: "Proyecto ▾" }).click();
  await page.getByRole("button", { name: "Recuperar el proyecto anterior" }).click();
  await expect(page.getByLabel("Subtítulo")).toHaveValue("Mi subtítulo único");
});

test("menus close with Escape", async ({ page }) => {
  await startExample(page);
  await page.getByRole("button", { name: "Proyecto ▾" }).click();
  await expect(page.getByRole("button", { name: "Nuevo proyecto" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Nuevo proyecto" })).toBeHidden();
  await page.getByRole("button", { name: /Apariencia/ }).click();
  await expect(page.getByRole("dialog", { name: "Apariencia" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Apariencia" })).toBeHidden();
});

test("a second tab does not edit at the same time, and can take over", async ({ page, context }) => {
  await startExample(page);
  const second = await context.newPage();
  await second.goto("/editor");
  await expect(second.getByText("Foja ya está abierto en otra pestaña")).toBeVisible();
  await second.getByRole("button", { name: "Editar en esta pestaña" }).click();
  await expect(second.getByLabel("Subtítulo")).toBeVisible();
  await expect(page.getByText("Foja se abrió en otra pestaña")).toBeVisible();
});
