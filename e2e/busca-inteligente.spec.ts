import { test, expect, type Page } from "@playwright/test";
import { clearOpportunities, closeTestDb, insertProcess, rebuildSearchIndex } from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

const titles = (page: Page) => page.locator("main ul > li a[href^='/processo/']").locator("h3").allTextContents();
const notice = (page: Page) => page.getByRole("status").filter({ hasText: "Mostrando resultados para" });

test("casinha mostra a faixa e o processo de casa; buscar exatamente remove a correção", async ({ page }) => {
  await insertProcess({ title: "Automação de casa inteligente" });
  await insertProcess({ title: "Outro assunto" });
  await rebuildSearchIndex();

  await page.goto("/processos?q=casinha");
  await expect(notice(page)).toContainText("Mostrando resultados para casa");
  await expect(notice(page)).toContainText("buscar exatamente casinha");
  expect(await titles(page)).toEqual(["Automação de casa inteligente"]);

  await page.getByRole("link", { name: /buscar exatamente/ }).click();
  await expect(page).toHaveURL(/corrigir=0/);
  await expect(notice(page)).toHaveCount(0);
  expect(await titles(page)).toEqual([]);
});

test("corrigir=0 sobrevive a filtro e uma busca nova volta a corrigir", async ({ page }) => {
  await insertProcess({ title: "Automação de casa inteligente", project: { category: "PET" } });
  await rebuildSearchIndex();
  await page.goto("/processos?q=casinha&corrigir=0");
  await page.locator("form[data-js]").waitFor({ state: "attached" });
  await page.getByRole("checkbox", { name: "PET" }).first().check();
  await expect(page).toHaveURL(/category=PET/);
  await expect(page).toHaveURL(/corrigir=0/);

  await page.getByRole("searchbox", { name: "Buscar processos" }).fill("casinha ");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).not.toHaveURL(/corrigir=0/);
  await expect(notice(page)).toBeVisible();
});

test("pyhton acha python", async ({ page }) => {
  await insertProcess({ title: "Iniciação em Python" });
  await rebuildSearchIndex();
  await page.goto("/processos?q=pyhton");
  await expect(notice(page)).toContainText("python");
  expect(await titles(page)).toEqual(["Iniciação em Python"]);
});

test("casa sem erro não mostra faixa", async ({ page }) => {
  await insertProcess({ title: "Automação de casa inteligente" });
  await rebuildSearchIndex();
  await page.goto("/processos?q=casa");
  expect(await titles(page)).toEqual(["Automação de casa inteligente"]);
  await expect(notice(page)).toHaveCount(0);
});

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("o link buscar exatamente funciona", async ({ page }) => {
    await insertProcess({ title: "Automação de casa inteligente" });
    await rebuildSearchIndex();
    await page.goto("/processos?q=casinha");
    await expect(notice(page)).toBeVisible();
    await page.getByRole("link", { name: /buscar exatamente/ }).click();
    await expect(page).toHaveURL(/corrigir=0/);
    await expect(notice(page)).toHaveCount(0);
  });
});
