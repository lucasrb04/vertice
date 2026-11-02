import { test, expect, type Page } from "@playwright/test";
import { clearOpportunities, closeTestDb, daysFromNow, insertProcess } from "./helpers";

const SLOGAN = "Encontre o projeto que vai impulsionar sua trajetória.";
const SUPPORT =
  "Iniciação científica, extensão, equipes de competição, PETs e empresas juniores da UNIFEI em um só lugar, com prazos e requisitos. Sem precisar de conta.";

const search = (page: Page) => page.getByRole("searchbox", { name: "Buscar processos" });

// Os testes desta suíte controlam exatamente o que está na vitrine.
test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

async function insertMany(count: number) {
  for (let i = 1; i <= count; i++) {
    await insertProcess({ title: `Processo em lote ${i}` });
  }
}

test("mostra slogan, apoio e busca sem exigir conta", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: SLOGAN })).toBeVisible();
  await expect(page.getByText(SUPPORT)).toBeVisible();
  await expect(search(page)).toHaveAttribute("placeholder", "Busque por projeto, área ou habilidade");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("banner").getByRole("link", { name: "Processos" })).toHaveAttribute("href", "/processos");
});

test("enviar a busca leva a /processos?q=", async ({ page }) => {
  await page.goto("/");
  await search(page).fill("robótica");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/processos");
  expect(new URL(page.url()).searchParams.get("q")).toBe("robótica");
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

test("atalhos de categoria e contagem de processos abertos", async ({ page }) => {
  await insertProcess({ title: "Processo A" });
  await insertProcess({ title: "Processo B" });
  await page.goto("/");
  await expect(page.getByText("2 processos abertos")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Extensão" }),
  ).toHaveAttribute("href", "/processos?category=EXTENSION");
});

test("carrosséis mostram processos abertos, com ordem e link Ver todos", async ({ page }) => {
  await insertProcess({
    title: "Bolsista de visão computacional",
    deadlineAt: daysFromNow(3),
    scholarshipType: "PAID",
    fundingAgency: "FAPEMIG",
    weeklyHours: 12,
    minSemester: 3,
    viewsCount: 4,
    project: { name: "Laboratório de Robótica Móvel", acronym: "LRM", hasInstitutionalBadge: true, category: "SCIENTIFIC_INIT" },
  });
  await insertProcess({ title: "Processo sem procura" });
  await insertProcess({ title: "Processo vencido", deadlineAt: daysFromNow(-1), viewsCount: 50 });
  await insertProcess({ title: "Processo encerrado", status: "CLOSED", viewsCount: 50 });
  await insertProcess({ title: "Processo pausado", status: "PAUSED", viewsCount: 50 });
  await insertProcess({ title: "Processo em revisão", status: "UNDER_REVIEW", viewsCount: 50 });
  await insertProcess({ title: "Processo de projeto suspenso", project: { status: "SUSPENDED" } });
  await insertProcess({ title: "Processo de projeto arquivado", project: { status: "ARCHIVED" } });

  await page.goto("/");

  const regions = page.getByRole("region");
  await expect(regions).toHaveCount(3);
  await expect(regions.nth(0)).toHaveAccessibleName("Últimos publicados");
  await expect(regions.nth(1)).toHaveAccessibleName("Encerrando em breve");
  await expect(regions.nth(2)).toHaveAccessibleName("Mais procurados");

  await expect(page.getByRole("link", { name: "Ver todos: Últimos publicados" })).toHaveAttribute(
    "href",
    "/processos?sort=recent",
  );
  await expect(page.getByRole("link", { name: "Ver todos: Encerrando em breve" })).toHaveAttribute(
    "href",
    "/processos?sort=deadline",
  );
  await expect(page.getByRole("link", { name: "Ver todos: Mais procurados" })).toHaveAttribute(
    "href",
    "/processos?sort=popular",
  );

  const recent = page.getByRole("region", { name: "Últimos publicados" });
  await expect(recent.getByRole("link")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Mais procurados" }).getByRole("link")).toHaveCount(1);

  const card = recent.getByRole("link", { name: /Bolsista de visão computacional/ });
  await expect(card).toContainText("LRM");
  await expect(card).toContainText("Verificado");
  await expect(card).toContainText("Iniciação científica");
  await expect(card).toContainText("Bolsa FAPEMIG");
  await expect(card).toContainText("12h/sem");
  await expect(card).toContainText("Todos os cursos · A partir do 3º período");
  await expect(card).toContainText("Encerra em 3 dias");
  await expect(card).toHaveAttribute("href", /^\/processo\/processo-e2e-/);

  await expect(page.getByText("Processo vencido")).toHaveCount(0);
  await expect(page.getByText("Processo encerrado")).toHaveCount(0);
  await expect(page.getByText("Processo pausado")).toHaveCount(0);
  await expect(page.getByText("Processo em revisão")).toHaveCount(0);
  await expect(page.getByText("Processo de projeto suspenso")).toHaveCount(0);
  await expect(page.getByText("Processo de projeto arquivado")).toHaveCount(0);
  await expect(page.getByText("2 processos abertos")).toBeVisible();
});

test("sem popularidade, Mais procurados não aparece", async ({ page }) => {
  await insertProcess({ title: "Processo novo" });
  await page.goto("/");
  await expect(page.getByRole("region")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Mais procurados" })).toHaveCount(0);
});

test("botões rolam o carrossel e desabilitam nas pontas; o teclado também rola", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await insertMany(8);
  await page.goto("/");

  const row = page.getByRole("region", { name: "Últimos publicados" });
  const next = page.getByRole("button", { name: "Ver próximos em Últimos publicados" });
  const prev = page.getByRole("button", { name: "Ver anteriores em Últimos publicados" });
  const scrollLeft = () => row.evaluate((el) => el.scrollLeft);

  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect.poll(scrollLeft).toBeGreaterThan(0);
  await expect(prev).toBeEnabled();

  // Espera a rolagem suave assentar antes de decidir se ainda há o que rolar.
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(500);
    if (await next.isDisabled()) break;
    await next.click();
  }
  await expect(next).toBeDisabled();
  await expect(row.getByRole("link").last()).toBeInViewport();

  await prev.click();
  await expect(next).toBeEnabled();

  await row.evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
  await expect(prev).toBeDisabled();
  await row.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(scrollLeft).toBeGreaterThan(0);
});

test("o teclado leva o carrossel ao fim sem perder o foco do botão", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await insertMany(8);
  await page.goto("/");

  const row = page.getByRole("region", { name: "Últimos publicados" });
  const next = page.getByRole("button", { name: "Ver próximos em Últimos publicados" });
  const scrollLeft = () => row.evaluate((el) => el.scrollLeft);

  await next.focus();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    if ((await next.getAttribute("aria-disabled")) === "true") break;
  }
  await expect(next).toHaveAttribute("aria-disabled", "true");
  await expect(next).toBeFocused();

  const before = await scrollLeft();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  expect(await scrollLeft()).toBe(before);
  await expect(next).toBeFocused();
});

test("com poucos processos não há botões de rolagem", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await insertProcess({ title: "Processo único" });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Últimos publicados" }).getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Ver próximos/ })).toHaveCount(0);
});

test.describe("celular de 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  const noPageOverflow = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  test("visitante: carrossel rola dentro de si, sem rolagem da página", async ({ page }) => {
    await insertMany(8);
    await insertProcess({
      title: "Título muito longo de processo seletivo para conferir o corte em duas linhas dentro do card da vitrine",
      viewsCount: 3,
      project: { name: "Núcleo de Estudos Avançados em Sistemas Embarcados e Internet das Coisas Aplicada" },
    });
    await page.goto("/");
    expect(await noPageOverflow(page)).toBe(true);

    const row = page.getByRole("region", { name: "Últimos publicados" });
    await expect(page.getByRole("button", { name: "Ver próximos em Últimos publicados" })).toBeEnabled();
    expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "Ver próximos em Últimos publicados" }).click();
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    expect(await noPageOverflow(page)).toBe(true);
  });

  test("logado: o cabeçalho cabe na largura", async ({ page }) => {
    const res = await page.request.post("/api/test-auth/login", {
      data: { email: "nome.bem.comprido@unifei.edu.br", name: "Maria Aparecida de Souza Albuquerque" },
    });
    expect(res.status()).toBe(200);
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("button", { name: "Sair" })).toBeVisible();
    expect(await noPageOverflow(page)).toBe(true);
  });
});

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a busca envia e o carrossel continua rolável", async ({ page }) => {
    await insertMany(8);
    await page.goto("/");
    const row = page.getByRole("region", { name: "Últimos publicados" });
    await expect(row).toHaveAttribute("tabindex", "0");
    await expect(row).toHaveCSS("overflow-x", "auto");
    await expect(page.getByRole("button", { name: /Ver próximos/ })).toHaveCount(0);

    await search(page).fill("baja");
    await search(page).press("Enter");
    await page.waitForURL((url) => url.pathname === "/processos" && url.searchParams.get("q") === "baja");
  });
});

test("sem processos abertos mostra o estado vazio com convite para publicar", async ({ page }) => {
  await insertProcess({ title: "Processo vencido", deadlineAt: daysFromNow(-1) });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nenhum processo aberto agora" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Publicar processo" })).toHaveAttribute("href", "/publicar");
  await expect(page.getByRole("region")).toHaveCount(0);
  await expect(page.getByText(/processos? abertos?$/)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: SLOGAN })).toBeVisible();
  await expect(search(page)).toBeVisible();
});
