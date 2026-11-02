import { test, expect } from "@playwright/test";
import { clearOpportunities, closeTestDb, daysFromNow, insertProcess } from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

const cards = (page: import("@playwright/test").Page) => page.locator("main ul > li a[href^='/processo/']");
const titles = (page: import("@playwright/test").Page) => cards(page).locator("h3").allTextContents();

// O envio automático só existe após a hidratação; interagir antes disso não submete.
const hydrated = (page: import("@playwright/test").Page) => page.locator("form[data-js]").waitFor({ state: "attached" });

test("busca sem acento acha título com acento", async ({ page }) => {
  await insertProcess({ title: "Equipe de Robótica" });
  await insertProcess({ title: "Outro assunto" });
  await page.goto("/processos");
  await page.getByRole("searchbox", { name: "Buscar processos" }).fill("robotica");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/q=robotica/);
  expect(await titles(page)).toEqual(["Equipe de Robótica"]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("1 processo seletivo");
  await expect(page.getByLabel("Ordenar por").locator("option:checked")).toHaveText("Relevância");
});

test("filtro de categoria muda a URL e os resultados; combinar e recarregar mantém o estado", async ({ page }) => {
  await insertProcess({ title: "Pesquisa A", project: { category: "PET" }, scholarshipType: "PAID" });
  await insertProcess({ title: "Pesquisa B", project: { category: "PET" }, scholarshipType: "VOLUNTARY" });
  await insertProcess({ title: "Extensão C", project: { category: "EXTENSION" } });
  await page.goto("/processos");
  await hydrated(page);
  await expect(cards(page)).toHaveCount(3);

  await page.getByRole("checkbox", { name: "PET" }).first().check();
  await expect(page).toHaveURL(/category=PET/);
  await expect(cards(page)).toHaveCount(2);

  await page.getByRole("radio", { name: /Voluntári/ }).check();
  await expect(page).toHaveURL(/scholarship=VOLUNTARY/);
  await expect(cards(page)).toHaveCount(1);

  await page.reload();
  await hydrated(page);
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: "PET" }).first()).toBeChecked();
  await expect(page.getByRole("radio", { name: /Voluntári/ })).toBeChecked();
});

test("incluir encerrados mostra o encerrado depois dos abertos", async ({ page }) => {
  await insertProcess({ title: "Encerrado antigo", deadlineAt: daysFromNow(-5), createdAt: daysFromNow(-1) });
  await insertProcess({ title: "Aberto antigo", createdAt: daysFromNow(-10) });
  await page.goto("/processos");
  await hydrated(page);
  expect(await titles(page)).toEqual(["Aberto antigo"]);
  await page.getByRole("checkbox", { name: "Incluir encerrados" }).check();
  await expect(page).toHaveURL(/encerrados=1/);
  await expect(cards(page)).toHaveCount(2);
  expect(await titles(page)).toEqual(["Aberto antigo", "Encerrado antigo"]);
});

test("ordenação por prazo", async ({ page }) => {
  await insertProcess({ title: "Prazo longe", deadlineAt: daysFromNow(30) });
  await insertProcess({ title: "Prazo perto", deadlineAt: daysFromNow(3) });
  await page.goto("/processos");
  await hydrated(page);
  await expect(page.getByLabel("Ordenar por").locator("option", { hasText: "Relevância" })).toHaveCount(0);
  await page.getByLabel("Ordenar por").selectOption("deadline");
  await expect(page).toHaveURL(/sort=deadline/);
  await expect.poll(() => titles(page)).toEqual(["Prazo perto", "Prazo longe"]);
});

test("paginação com 13 processos", async ({ page }) => {
  for (let i = 1; i <= 13; i++) await insertProcess({ title: `Lote ${i}`, createdAt: daysFromNow(-i) });
  await page.goto("/processos");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("13 processos seletivos");
  await expect(cards(page)).toHaveCount(12);
  await page.getByRole("link", { name: "Próxima" }).click();
  await expect(page).toHaveURL(/page=2/);
  expect(await titles(page)).toEqual(["Lote 13"]);
  await page.getByRole("link", { name: "Anterior" }).click();
  await expect(cards(page)).toHaveCount(12);
});

test("sem resultados oferece limpar", async ({ page }) => {
  await insertProcess({ title: "Algo" });
  await page.goto("/processos?q=zzzzqqqq");
  await expect(page.getByText("Nenhum processo encontrado")).toBeVisible();
  await page.getByRole("link", { name: "Limpar busca e filtros" }).click();
  await expect(page).toHaveURL(/\/processos$/);
  await expect(cards(page)).toHaveCount(1);
});

test("parâmetros inválidos abrem normalmente", async ({ page }) => {
  await insertProcess({ title: "Algo" });
  const res = await page.goto("/processos?page=abc&sort=x&category=y");
  expect(res?.status()).toBe(200);
  await expect(cards(page)).toHaveCount(1);
});

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("buscar e aplicar filtro funciona", async ({ page }) => {
    await insertProcess({ title: "Robótica PET", project: { category: "PET" } });
    await insertProcess({ title: "Robótica Extensão", project: { category: "EXTENSION" } });
    await page.goto("/processos");
    await page.getByRole("searchbox", { name: "Buscar processos" }).fill("robotica");
    await page.getByRole("checkbox", { name: "PET" }).first().check();
    await expect(page.getByRole("button", { name: "Aplicar" })).toBeVisible();
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/category=PET/);
    await expect(page).toHaveURL(/q=robotica/);
    expect(await titles(page)).toEqual(["Robótica PET"]);
  });
});
