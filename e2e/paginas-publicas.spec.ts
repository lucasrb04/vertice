import { expect, type Page, test } from "@playwright/test";
import { deadlineLabel } from "../src/lib/projects/labels";
import { deadlineDate } from "../src/lib/public/labels";
import { formatDay } from "../src/lib/time";
import { addProcess, closeTestDb, daysFromNow, insertProcess, opportunityCounters } from "./helpers";

const EDITAL = "https://edital.example.com/e2e.pdf";

test.afterAll(closeTestDb);

const noPageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("/processo/[slug]", () => {
  test("mostra dados, cronograma só com datas preenchidas, requisitos e metadados, sem login", async ({ page }) => {
    const { opportunity, project } = await insertProcess({
      title: "Bolsista de visão computacional",
      description: "Atividades **principais** do bolsista.\n\n- treinar modelos\n\n[x](javascript:alert(1))",
      externalUrl: EDITAL,
      scholarshipType: "PAID",
      fundingAgency: "FAPEMIG",
      scholarshipValueCents: 70_000,
      weeklyHours: 12,
      vacanciesCount: 3,
      minSemester: 3,
      maxSemester: 8,
      applicationsOpenOn: "2026-11-01",
      resultOn: "2026-12-15",
      availabilityRequirement: "Terças à tarde",
      noOtherScholarship: true,
      project: {
        name: "Laboratório de Robótica",
        acronym: "LR",
        hasInstitutionalBadge: true,
        category: "SCIENTIFIC_INIT",
      },
    });

    await page.goto(`/processo/${opportunity.slug}`);
    await expect(page).toHaveTitle(/Bolsista de visão computacional/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /^Atividades principais do bolsista\. treinar modelos/,
    );

    await expect(page.getByRole("heading", { level: 1, name: "Bolsista de visão computacional" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Laboratório de Robótica/ })).toHaveAttribute(
      "href",
      `/projeto/${project.slug}`,
    );
    await expect(page.getByRole("main")).toContainText("Iniciação científica");
    await expect(page.getByRole("main")).toContainText("Verificado");
    await expect(page.getByText(deadlineLabel(opportunity.deadlineAt))).toBeVisible();

    const edital = page.getByRole("link", { name: "Acessar edital" });
    await expect(edital).toHaveAttribute("href", `/processo/${opportunity.slug}/edital`);
    await expect(edital).toHaveAttribute("target", "_blank");
    await expect(edital).toHaveAttribute("rel", "nofollow noopener");
    expect(await page.locator(`a[href="${EDITAL}"]`).count()).toBe(0);

    await expect(page.locator("main strong", { hasText: "principais" })).toBeVisible();
    await expect(page.locator("main li", { hasText: "treinar modelos" })).toBeVisible();
    await expect(page.locator('a[href^="javascript"]')).toHaveCount(0);

    const schedule = page.getByRole("region", { name: "Cronograma" });
    await expect(schedule).toContainText("01/11/2026");
    await expect(schedule).toContainText("15/12/2026");
    await expect(schedule).toContainText(formatDay(opportunity.deadlineAt));
    await expect(schedule).not.toContainText("Entrevistas");
    await expect(schedule).not.toContainText("Início das atividades");

    const requirements = page.getByRole("region", { name: "Requisitos" });
    await expect(requirements).toContainText("Todos os cursos");
    await expect(requirements).toContainText("Do 3º ao 8º período");
    await expect(requirements).toContainText("Terças à tarde");
    await expect(requirements).toContainText("Não acumular com outra bolsa");

    await expect(page.getByRole("main")).toContainText("Bolsa de R$ 700/mês · FAPEMIG");
    await expect(page.getByRole("main")).toContainText("12 h por semana");
  });

  test("a ação principal fica no card de inscrição", async ({ page }) => {
    const { opportunity } = await insertProcess({ title: "Processo com inscrição", internalSelectionEnabled: true });
    await page.goto(`/processo/${opportunity.slug}`);
    const aside = page.getByRole("complementary", { name: "Inscrição" });
    await expect(aside.getByRole("link", { name: "Candidatar-se" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Acessar edital" })).toBeVisible();
  });

  test("sem datas opcionais não há Cronograma; prazo próximo fica em âmbar", async ({ page }) => {
    const { opportunity } = await insertProcess({ title: "Processo curto", deadlineAt: daysFromNow(3) });
    await page.goto(`/processo/${opportunity.slug}`);
    await expect(page.getByRole("heading", { name: "Cronograma" })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Inscrição" }).getByText("Encerra em 3 dias")).toHaveClass(
      /text-urgent-ink/,
    );
  });

  test("abertura futura: selo na lista e na página, com o edital disponível", async ({ page }) => {
    const opens = formatDay(daysFromNow(10)).slice(0, 5);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(daysFromNow(10));
    const { opportunity } = await insertProcess({
      title: "Processo que abre em breve",
      externalUrl: EDITAL,
      applicationsOpenOn: day,
      deadlineAt: daysFromNow(30),
    });

    await page.goto(`/processo/${opportunity.slug}`);
    await expect(page.getByText(`Abre em ${opens}`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Acessar edital" })).toBeVisible();

    await page.goto("/");
    const card = page.locator("article", { has: page.getByRole("link", { name: /Processo que abre em breve/ }) });
    await expect(card).toContainText(
      `Inscrições abrem em ${deadlineDate(daysFromNow(10))} · até ${deadlineDate(daysFromNow(30))}`,
    );
  });

  test("abertura amanhã com prazo em 3 dias: o card mostra abertura e prazo no selo rosa", async ({ page }) => {
    const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(daysFromNow(1));
    await insertProcess({
      title: "Abre amanhã e encerra logo",
      applicationsOpenOn: tomorrow,
      deadlineAt: daysFromNow(3),
    });

    await page.goto("/");
    const card = page.locator("article", { has: page.getByRole("link", { name: /Abre amanhã e encerra logo/ }) });
    const chip = card.getByText(
      `Inscrições abrem em ${deadlineDate(daysFromNow(1))} · até ${deadlineDate(daysFromNow(3))}`,
    );
    await expect(chip).toHaveClass(/bg-rosa-soft/);
  });

  test("clique abre o destino e conta 1 mesmo clicando duas vezes; visualização conta 1", async ({ page, context }) => {
    const { opportunity } = await insertProcess({ title: "Processo com edital", externalUrl: EDITAL });

    await page.goto(`/processo/${opportunity.slug}`);
    await expect.poll(async () => (await opportunityCounters(opportunity.id)).views).toBe(1);
    await page.reload();

    for (let i = 0; i < 2; i++) {
      // O Playwright não intercepta o alvo de um redirect e example.com não resolve: o destino é conferido no 302.
      const [popup, redirect] = await Promise.all([
        context.waitForEvent("page"),
        context.waitForEvent("response", (r) => r.url().endsWith(`/processo/${opportunity.slug}/edital`)),
        page.getByRole("link", { name: "Acessar edital" }).click(),
      ]);
      expect(redirect.status()).toBe(302);
      expect(redirect.headers().location).toBe(EDITAL);
      await popup.close();
    }
    const counters = await opportunityCounters(opportunity.id);
    expect(counters).toEqual({ views: 1, clicks: 1 });
  });

  test("encerrado: aviso com data, conteúdo legível, edital como link simples e outros processos", async ({ page }) => {
    const { opportunity, project } = await insertProcess({
      title: "Processo já encerrado",
      description: "Descrição continua legível.",
      externalUrl: EDITAL,
      status: "CLOSED",
      closedAt: new Date("2026-10-10T15:00:00Z"),
    });
    await page.goto(`/processo/${opportunity.slug}`);
    await expect(page.getByRole("status")).toContainText("Processo encerrado em 10/10/2026");
    await expect(page.getByText("Descrição continua legível.")).toBeVisible();
    const edital = page.getByRole("link", { name: "Acessar edital" });
    await expect(edital).toHaveAttribute("href", `/processo/${opportunity.slug}/edital`);
    await expect(edital).not.toHaveAttribute("data-slot", "button");
    await expect(page.getByRole("link", { name: "Ver outros processos do projeto" })).toHaveAttribute(
      "href",
      `/projeto/${project.slug}`,
    );
  });

  test("encerrado sem data mostra só o aviso", async ({ page }) => {
    const { opportunity } = await insertProcess({ title: "Processo pausado", status: "PAUSED" });
    await page.goto(`/processo/${opportunity.slug}`);
    await expect(page.getByRole("status")).toHaveText(/^Processo encerrado\b(?! em)/);
  });

  test("oculto e inexistente dão 404 e não contam visualização", async ({ page }) => {
    const review = await insertProcess({ title: "Em revisão", status: "UNDER_REVIEW" });
    const suspended = await insertProcess({ title: "Suspenso", project: { status: "SUSPENDED" } });
    for (const { opportunity } of [review, suspended]) {
      const res = await page.goto(`/processo/${opportunity.slug}`);
      expect(res?.status()).toBe(404);
      await expect(page).not.toHaveTitle(new RegExp(opportunity.title));
      expect((await opportunityCounters(opportunity.id)).views).toBe(0);
    }
    expect((await page.goto("/processo/slug-inexistente"))?.status()).toBe(404);
  });

  test("slug com byte nulo ou longo demais dá 404, não 500", async ({ page }) => {
    expect((await page.goto("/processo/a%00b"))?.status()).toBe(404);
    expect((await page.goto(`/processo/${"a".repeat(141)}`))?.status()).toBe(404);
    expect((await page.goto("/projeto/a%00b"))?.status()).toBe(404);
    expect((await page.goto(`/projeto/${"a".repeat(101)}`))?.status()).toBe(404);
  });
});

test.describe("/projeto/[slug]", () => {
  test("mostra dados, abertos, anteriores e nenhum membro", async ({ page, request }) => {
    const { project, opportunity } = await insertProcess({
      title: "Processo aberto do projeto",
      project: {
        name: "Equipe Pública",
        acronym: "EP",
        institute: "IESTI",
        advisorName: "Prof.ª Orientadora",
        description: "Sobre a **equipe**.",
        websiteUrl: "https://equipe.example.com",
        instagramUrl: "http://inseguro.example.com",
        contactEmail: "equipe@unifei.edu.br",
        hasInstitutionalBadge: true,
      },
    });
    await addProcess(project.id, { title: "Processo em revisão", status: "UNDER_REVIEW" });

    await page.goto(`/projeto/${project.slug}`);
    await expect(page).toHaveTitle(/Equipe Pública/);
    await expect(page.getByRole("heading", { level: 1, name: "Equipe Pública" })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main).toContainText("IESTI");
    await expect(main).toContainText("Prof.ª Orientadora");
    await expect(main).toContainText("Verificado");
    await expect(page.locator("main strong", { hasText: "equipe" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Site" })).toHaveAttribute("href", "https://equipe.example.com");
    await expect(page.getByRole("link", { name: "Instagram" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "equipe@unifei.edu.br" })).toHaveAttribute(
      "href",
      "mailto:equipe@unifei.edu.br",
    );

    const open = page.getByRole("region", { name: "Processos abertos" });
    await expect(open.getByRole("link", { name: /Processo aberto do projeto/ })).toHaveAttribute(
      "href",
      `/processo/${opportunity.slug}`,
    );
    await expect(page.getByRole("heading", { name: "Processos anteriores" })).toHaveCount(0);
    await expect(main).not.toContainText("Processo em revisão");
    await expect(main).not.toContainText(/membros?/i);

    const body = await (await request.get(`/projeto/${project.slug}`)).text();
    expect(body).not.toMatch(/userId|user_id|project_members/);
  });

  test("anteriores vêm do mais recente ao mais antigo; arquivado mostra rótulo", async ({ page }) => {
    const { project } = await insertProcess({
      title: "Encerrado antigo",
      status: "CLOSED",
      closedAt: daysFromNow(-30),
      project: { status: "ARCHIVED" },
    });
    await addProcess(project.id, { title: "Encerrado recente", status: "CLOSED", closedAt: daysFromNow(-2) });
    await page.goto(`/projeto/${project.slug}`);
    await expect(page.getByText("Projeto arquivado")).toBeVisible();
    const previous = page.getByRole("region", { name: "Processos anteriores" }).getByRole("link");
    await expect(previous).toHaveCount(2);
    await expect(previous.nth(0)).toContainText("Encerrado recente");
    await expect(previous.nth(1)).toContainText("Encerrado antigo");
    await expect(page.getByRole("region", { name: "Processos abertos" })).toContainText("Nenhum processo aberto");
  });

  test("oculto dá 404", async ({ page }) => {
    const { project } = await insertProcess({ title: "Suspenso", project: { status: "SUSPENDED" } });
    expect((await page.goto(`/projeto/${project.slug}`))?.status()).toBe(404);
  });
});

test("painel privado tem link para a página pública", async ({ page }) => {
  const res = await page.request.post("/api/test-auth/login", {
    data: { email: "dono.painel.publico@unifei.edu.br", name: "Dono Painel" },
  });
  expect(res.status()).toBe(200);
  await page.goto("/publicar?novo=1");
  await page.getByLabel("Nome do projeto").fill("Projeto do link público");
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Projeto especial" }).click();
  await page.getByLabel("Descrição curta").fill("Projeto de teste do link.");
  await page.getByLabel("E-mail de contato").fill("contato@equipe.com");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Título do processo").fill("Processo do link público");
  await page.getByLabel("Descrição das atividades").fill("Atividades.");
  await page.getByLabel("Prazo final de inscrição").fill(daysFromNow(10).toISOString().slice(0, 10));
  await page.getByLabel("Link do edital ou formulário").fill("https://unifei.edu.br/edital.pdf");
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}\?publicado=[0-9a-f-]{36}$/);

  await page.getByRole("link", { name: "Ver página pública" }).click();
  await page.waitForURL(/\/projeto\/projeto-do-link-publico/);
  await expect(page.getByRole("heading", { level: 1, name: "Projeto do link público" })).toBeVisible();
});

test.describe("celular de 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("textos longos não criam rolagem horizontal", async ({ page }) => {
    const longWord = "a".repeat(120);
    const { opportunity, project } = await insertProcess({
      title: `Processo com palavra enorme ${longWord}`,
      description: `Texto ${longWord} e [link](https://example.com/${longWord}).`,
      project: { name: `Projeto ${longWord}`.slice(0, 140), websiteUrl: `https://example.com/${longWord}` },
    });
    await page.goto(`/processo/${opportunity.slug}`);
    expect(await noPageOverflow(page)).toBe(true);
    await page.goto(`/projeto/${project.slug}`);
    expect(await noPageOverflow(page)).toBe(true);
  });
});

test("prefetch do roteador não conta visualização", async ({ request }) => {
  const { opportunity } = await insertProcess({ title: "Processo prefetch" });
  const res = await request.get(`/processo/${opportunity.slug}`, {
    headers: { RSC: "1", "Next-Router-Prefetch": "1" },
  });
  expect(res.status()).toBe(200);
  await new Promise((r) => setTimeout(r, 1000));
  expect((await opportunityCounters(opportunity.id)).views).toBe(0);
});
