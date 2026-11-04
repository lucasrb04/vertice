import { expect, test } from "@playwright/test";
import { clearOpportunities, closeTestDb, daysFromNow, insertProcess, rebuildSearchIndex } from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

const cards = (page: import("@playwright/test").Page) => page.locator("main ul > li a[href^='/processo/']");
const titles = (page: import("@playwright/test").Page) => cards(page).locator("h3").allTextContents();

// O envio automático só existe após a hidratação; interagir antes disso não submete.
const hydrated = (page: import("@playwright/test").Page) =>
  page.locator("form[data-js]").waitFor({ state: "attached" });

test("busca sem acento acha título com acento", async ({ page }) => {
  await insertProcess({ title: "Equipe de Robótica" });
  await insertProcess({ title: "Outro assunto" });
  await rebuildSearchIndex();
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
    await rebuildSearchIndex();
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

test.describe("celular, com JavaScript", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("marcar duas categorias mantém o painel aberto, o foco e uma URL sem parâmetros vazios", async ({ page }) => {
    await insertProcess({ title: "PET um", project: { category: "PET" } });
    await insertProcess({ title: "Extensão um", project: { category: "EXTENSION" } });
    await insertProcess({ title: "Outro um", project: { category: "LAB_GROUP" } });
    await page.goto("/processos");
    await hydrated(page);
    await page.getByText("Filtros", { exact: true }).click();
    const details = page.locator("details");
    await expect(details).toHaveJSProperty("open", true);

    const pet = page.getByRole("checkbox", { name: "PET" }).first();
    await pet.check();
    await expect(page).toHaveURL(/category=PET/);
    const extension = page.getByRole("checkbox", { name: /Extensão/ }).first();
    await extension.check();
    await expect(page).toHaveURL(/category=EXTENSION/);
    await expect(page).toHaveURL(/category=PET/);
    expect(new URL(page.url()).search).not.toMatch(/=(&|$)/);
    await expect(cards(page)).toHaveCount(2);
    await expect(details).toHaveJSProperty("open", true);
    await expect(extension).toBeFocused();
  });

  test("desmarcar o último filtro mantém o painel aberto", async ({ page }) => {
    await insertProcess({ title: "PET um", project: { category: "PET" } });
    await page.goto("/processos");
    await hydrated(page);
    await page.getByText("Filtros", { exact: true }).click();
    const details = page.locator("details");
    const pet = page.getByRole("checkbox", { name: "PET" }).first();
    await pet.check();
    await expect(page).toHaveURL(/category=PET/);
    await pet.uncheck();
    await expect(page).not.toHaveURL(/category=/);
    await expect(details).toHaveJSProperty("open", true);
  });

  test("a ordenação pelo teclado mantém o foco e o seletor acompanha o histórico", async ({ page }) => {
    await insertProcess({ title: "Prazo longe", deadlineAt: daysFromNow(30) });
    await insertProcess({ title: "Prazo perto", deadlineAt: daysFromNow(3) });
    await page.goto("/processos");
    await hydrated(page);
    const sort = page.locator("select#ordenacao");
    await sort.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/sort=deadline/);
    await expect(sort).toBeFocused();
    await expect(sort.locator("option:checked")).toHaveText("Prazo mais próximo");

    // O envio automático usa `replace`; uma navegação com `push` cria o histórico para voltar.
    await page.evaluate(() =>
      (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(
        "/processos?sort=popular",
      ),
    );
    await expect(sort.locator("option:checked")).toHaveText("Mais procurados");
    await page.goBack();
    await expect(page).toHaveURL(/sort=deadline/);
    await expect(sort.locator("option:checked")).toHaveText("Prazo mais próximo");
    await expect(sort).toHaveValue("deadline");
  });
});

// O prefetch de links para /processos?q= gastaria o limite de buscas: cada página carregada faz uma só requisição com `q`.
const countSearchRequests = (page: import("@playwright/test").Page) => {
  const urls: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname === "/processos" && url.searchParams.has("q")) urls.push(req.url());
  });
  return urls;
};

test("busca paginada faz uma só requisição com q por página carregada", async ({ page }) => {
  for (let i = 1; i <= 13; i++) await insertProcess({ title: `Robótica ${i}` });
  await rebuildSearchIndex();
  const urls = countSearchRequests(page);

  await page.goto("/processos?q=robotica");
  await hydrated(page);
  await page.getByRole("navigation", { name: "Paginação" }).scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  expect(urls).toHaveLength(1);

  await page.getByRole("link", { name: "Página 2" }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.waitForLoadState("networkidle");
  expect(urls).toHaveLength(2);
});

test("busca com correção faz uma só requisição com q", async ({ page }) => {
  await insertProcess({ title: "Automação de casa inteligente" });
  await rebuildSearchIndex();
  const urls = countSearchRequests(page);

  await page.goto("/processos?q=casinha");
  await expect(page.getByRole("link", { name: /buscar exatamente/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(urls).toHaveLength(1);
});
