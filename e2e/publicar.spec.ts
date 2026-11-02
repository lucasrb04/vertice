import { test, expect, type Page } from "@playwright/test";
import { HTTPS_ONLY } from "../src/lib/validation/common";

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

/** Hoje + `days` no fuso de Brasília, como YYYY-MM-DD (valor de `<input type="date">`). */
function dayInSaoPaulo(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fillProjectStep(page: Page, name: string) {
  await page.getByLabel("Nome do projeto").fill(name);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Projeto especial" }).click();
  await page.getByLabel("Descrição curta").fill("Equipe de competição de veículos off-road.");
  await page.getByLabel("E-mail de contato").fill("contato@equipe.com");
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function fillOpportunityRequired(page: Page, title: string, url: string) {
  await page.getByLabel("Título do processo").fill(title);
  await page.getByLabel("Descrição das atividades").fill("Projetar e montar o sistema de suspensão.");
  await page.getByLabel("Prazo final de inscrição").fill(dayInSaoPaulo(10));
  await page.getByLabel("Link do edital ou formulário").fill(url);
}

test("usuário sem projeto publica projeto e processo só com os obrigatórios", async ({ page }) => {
  await loginAs(page, "lider@unifei.edu.br", "Líder");
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Publicar processo" }).click();
  await expect(page).toHaveURL(/\/publicar$/);

  await fillProjectStep(page, "Equipe Baja Itajubá");
  await fillOpportunityRequired(page, "Processo seletivo 2026/2", "https://unifei.edu.br/edital.pdf");
  await page.getByRole("button", { name: "Publicar" }).click();

  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Equipe Baja Itajubá" })).toBeVisible();
  const abertos = page.getByRole("region", { name: "Abertos" });
  await expect(abertos.getByText("Processo seletivo 2026/2")).toBeVisible();
  const projectId = new URL(page.url()).pathname.split("/").pop();

  // Com projeto, /publicar lista os projetos e oferece criar outro.
  await page.goto("/publicar");
  await expect(page.getByRole("link", { name: /Equipe Baja Itajubá/ })).toHaveAttribute(
    "href",
    `/projetos/${projectId}/processos/novo`,
  );
  await page.getByRole("link", { name: "Criar novo projeto" }).click();
  await expect(page).toHaveURL(/\/publicar\?novo=1$/);
  await expect(page.getByLabel("Nome do projeto")).toBeVisible();
});

test("link http é recusado com mensagem", async ({ page }) => {
  await loginAs(page, "http.teste@unifei.edu.br", "Http Teste");
  await page.goto("/publicar");
  await fillProjectStep(page, "Projeto Http");
  await fillOpportunityRequired(page, "Processo com link http", "http://x.com");
  await page.getByRole("button", { name: "Publicar" }).click();

  const field = page.getByLabel("Link do edital ou formulário");
  await expect(page.getByText(HTTPS_ONLY)).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/publicar$/);

  // Depois da recusa o Turnstile é renovado: corrigir o link e publicar funciona.
  await field.fill("https://unifei.edu.br/edital-http.pdf");
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Projeto Http" })).toBeVisible();
});

test("publica processo só com seleção pela plataforma e pergunta", async ({ page }) => {
  await loginAs(page, "plataforma@unifei.edu.br", "Plataforma");
  await page.goto("/publicar");
  await fillProjectStep(page, "Projeto Plataforma");
  await fillOpportunityRequired(page, "Processo pela plataforma", "");
  const toggle = page.getByRole("checkbox", { name: /Seleção pela plataforma/ });
  await expect(toggle).toBeEnabled();
  await expect(page.getByText("Em breve", { exact: true })).toHaveCount(0);
  await toggle.check();
  await page.getByLabel("Pergunta para os candidatos").fill("Qual sua experiência com CAD?");
  await page.getByRole("button", { name: "Publicar" }).click();

  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}$/);
  const abertos = page.getByRole("region", { name: "Abertos" });
  await expect(abertos.getByText("Processo pela plataforma")).toBeVisible();
  await expect(abertos.getByText("Plataforma", { exact: true })).toBeVisible();
});

test("tag nova criada com Enter aparece como badge", async ({ page }) => {
  await loginAs(page, "tags@unifei.edu.br", "Tags");
  await page.goto("/publicar");
  await fillProjectStep(page, "Projeto Tags");
  await page.getByRole("main").getByText("Tags", { exact: true }).click();
  const input = page.getByRole("combobox", { name: "Tema" });
  await input.fill("Suspensão veicular xyz");
  await input.press("Enter");
  const chosen = page.getByRole("list", { name: "Tags escolhidas: Tema" });
  await expect(chosen.getByText("Suspensão veicular xyz")).toBeVisible();
  await expect(input).toHaveValue("");

  // O mesmo termo com outra caixa/acento não se repete no grupo.
  await input.fill("suspensao VEICULAR xyz");
  await input.press("Enter");
  await expect(chosen.getByRole("listitem")).toHaveCount(1);

  // Tag existente encontrada pela busca é escolhida com Enter.
  await input.fill("pyth");
  await expect(page.getByRole("option", { name: "Python" })).toBeVisible();
  await input.fill("python");
  await expect(page.getByRole("option", { name: "Python" })).toBeVisible();
  await input.press("Enter");
  await expect(chosen.getByText("Python", { exact: true })).toBeVisible();
  await expect(chosen.getByRole("listitem")).toHaveCount(2);

  await fillOpportunityRequired(page, "Processo com tags", "https://unifei.edu.br/edital-tags.pdf");
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}$/);
});
