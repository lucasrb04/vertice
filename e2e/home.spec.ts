import { expect, type Page, test } from "@playwright/test";
import { clearOpportunities, closeTestDb, daysFromNow, insertProcess, rebuildSearchIndex } from "./helpers";

const search = (page: Page) => page.getByRole("searchbox", { name: "Buscar processos" });
const titles = (page: Page) => page.locator("main article h3").allTextContents();
const hydrated = (page: Page) => page.locator("form[data-js]").waitFor({ state: "attached" });
const tabs = (page: Page) => page.getByRole("navigation", { name: "Situação das inscrições" });
const noPageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const today = (offset: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(daysFromNow(offset));

// Os testes desta suíte controlam exatamente o que está na lista.
test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

test("a inicial é a lista: sem filtros, do último publicado ao mais antigo", async ({ page }) => {
  await insertProcess({ title: "Mais antigo", createdAt: daysFromNow(-9) });
  await insertProcess({ title: "Mais novo", createdAt: daysFromNow(0) });
  await insertProcess({ title: "Do meio", createdAt: daysFromNow(-3) });
  await page.goto("/");
  expect(await titles(page)).toEqual(["Mais novo", "Do meio", "Mais antigo"]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("3 processos abertos");
  await expect(page.getByText("Filtrando por")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Limpar tudo" })).toHaveCount(0);
  await expect(search(page)).toHaveAttribute("placeholder", "Busque por tema, projeto ou habilidade");
  await expect(page.getByRole("banner").getByRole("link", { name: "Processos" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("enviar a busca fica em /?q=", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  await search(page).fill("robótica");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("q") === "robótica");
});

test("a tecla / foca a busca, exceto quando já se está digitando", async ({ page }) => {
  await page.goto("/");
  await expect(search(page)).not.toBeFocused();
  await page.keyboard.press("/");
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue("");

  await page.keyboard.type("c/c++");
  await expect(search(page)).toHaveValue("c/c++");
});

test("marcar categoria mostra Filtrando por; o x da etiqueta volta ao estado limpo", async ({ page }) => {
  await insertProcess({ title: "PET um", project: { category: "PET" } });
  await insertProcess({ title: "Extensão um", project: { category: "EXTENSION" } });
  await page.goto("/");
  await hydrated(page);
  await page.getByRole("checkbox", { name: /^PET/ }).check();
  await expect(page).toHaveURL(/category=PET/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("1 processo encontrado");
  const box = page.getByRole("region", { name: "Filtrando por" });
  await expect(box).toContainText("PET");
  await box.getByRole("link", { name: "Remover PET" }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.search === "");
  await expect(page.getByText("Filtrando por")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /^PET/ })).not.toBeChecked();
  await expect(page.locator("main article")).toHaveCount(2);
});

test("abas filtram e contam respeitando os filtros", async ({ page }) => {
  await insertProcess({ title: "Encerra logo", deadlineAt: daysFromNow(2), project: { category: "PET" } });
  await insertProcess({ title: "Abre depois", applicationsOpenOn: today(4), deadlineAt: daysFromNow(20) });
  await insertProcess({ title: "Comum", deadlineAt: daysFromNow(30) });
  await page.goto("/");
  await expect(tabs(page).getByRole("link", { name: /Abertos/ })).toContainText("3");
  await expect(tabs(page).getByRole("link", { name: /Encerram em 7 dias/ })).toContainText("1");
  await expect(tabs(page).getByRole("link", { name: /Abrem em breve/ })).toContainText("1");

  await tabs(page)
    .getByRole("link", { name: /Abrem em breve/ })
    .click();
  await expect(page).toHaveURL(/situacao=em-breve/);
  expect(await titles(page)).toEqual(["Abre depois"]);
  await expect(tabs(page).getByRole("link", { name: /Abrem em breve/ })).toHaveAttribute("aria-current", "page");

  await page.goto("/?category=PET");
  await expect(tabs(page).getByRole("link", { name: /Abertos/ })).toContainText("1");
  await expect(tabs(page).getByRole("link", { name: /Abrem em breve/ })).toContainText("0");
});

test("aba vazia oferece ver todos os abertos", async ({ page }) => {
  await insertProcess({ title: "Comum", deadlineAt: daysFromNow(30) });
  await page.goto("/?situacao=em-breve");
  await expect(page.getByRole("heading", { name: "Nenhum processo nesta aba" })).toBeVisible();
  await page.getByRole("link", { name: "Ver todos os abertos" }).click();
  await page.waitForURL((url) => url.pathname === "/" && !url.searchParams.has("situacao"));
  expect(await titles(page)).toEqual(["Comum"]);
});

test("fechar a dica para quem publica persiste após recarregar", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  const tip = page.getByRole("region", { name: "Lidera uma equipe, laboratório ou projeto?" });
  await expect(tip.getByRole("link", { name: "Publicar processo" })).toHaveAttribute("href", "/publicar");
  await tip.getByRole("button", { name: "Fechar dica" }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Lidera uma equipe, laboratório ou projeto?" })).toHaveCount(0);
});

test("termo buscado aparece realçado no título", async ({ page }) => {
  await insertProcess({ title: "Equipe de Robótica" });
  await rebuildSearchIndex();
  await page.goto("/?q=robotica");
  await expect(page.locator("main article h3 mark")).toHaveText("Robótica");
});

test("sem processos abertos mostra o estado vazio com convite para publicar", async ({ page }) => {
  await insertProcess({ title: "Processo vencido", deadlineAt: daysFromNow(-1) });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nenhum processo aberto agora" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Publicar processo" }).first()).toHaveAttribute(
    "href",
    "/publicar",
  );
  await expect(search(page)).toBeVisible();
});

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Filtros abre a folha; Esc fecha e devolve o foco", async ({ page }) => {
    await insertProcess({ title: "PET um", project: { category: "PET" } });
    await insertProcess({ title: "Outro", project: { category: "EXTENSION" } });
    await page.goto("/");
    await hydrated(page);
    const trigger = page.getByRole("button", { name: /^Filtros/ });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("checkbox", { name: /^PET/ }).check();
    await expect(page).toHaveURL(/category=PET/);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Ver 1 processo" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toContainText("1");
  });
});

test.describe("celular de 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("card com título e projeto compridos não cria rolagem horizontal", async ({ page }) => {
    await insertProcess({
      title: "T".repeat(160),
      project: { name: "N".repeat(140), acronym: "SIGLACOMPRIDA2026" },
    });
    await page.goto("/");
    await expect(page.locator("main article")).toHaveCount(1);
    expect(await noPageOverflow(page)).toBe(true);
  });

  test("logado: o cabeçalho cabe na largura", async ({ page }) => {
    const res = await page.request.post("/api/test-auth/login", {
      data: { email: "nome.bem.comprido@unifei.edu.br", name: "Maria Aparecida de Souza Albuquerque" },
    });
    expect(res.status()).toBe(200);
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("button", { name: /^Menu da conta de/ })).toBeVisible();
    expect(await noPageOverflow(page)).toBe(true);
  });
});
