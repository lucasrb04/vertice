import { expect, type Page, test } from "@playwright/test";
import { addProjectMember, clearOpportunities, closeTestDb, insertApplication, insertProcess } from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

const ACCOUNT_LINE = "Use sua conta Google @unifei.edu.br. O primeiro acesso cria a sua conta.";

test("visitante vê Publicar processo no cabeçalho e o login diz para quê", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
  await banner.getByRole("link", { name: "Publicar processo" }).click();

  await page.waitForURL(/\/entrar\?next=%2Fpublicar$/);
  const main = page.getByRole("main");
  await expect(main).toContainText(
    "Entre para publicar o processo seletivo do seu projeto. Qualquer conta @unifei.edu.br publica, sem aprovação prévia.",
  );
  await expect(main).toContainText(ACCOUNT_LINE);
  // Um só "Entrar com Google" na tela.
  await expect(page.getByText("Entrar com Google")).toHaveCount(1);
});

test("login vindo de Candidatar-se cita o processo; slug desconhecido não cita nada", async ({ page }) => {
  const { opportunity } = await insertProcess({ title: "Processo da entrada", internalSelectionEnabled: true });
  await page.goto(`/entrar?next=${encodeURIComponent(`/processo/${opportunity.slug}/candidatar`)}`);
  await expect(page.getByRole("main")).toContainText("Entre para se candidatar a Processo da entrada.");

  await page.goto(`/entrar?next=${encodeURIComponent("/processo/nao-existe/candidatar")}`);
  await expect(page.getByRole("main")).toContainText(ACCOUNT_LINE);
  await expect(page.getByRole("main")).not.toContainText("Entre para");
});

test("painel vazio: duas metades, cada uma com o próximo passo", async ({ page }) => {
  await loginAs(page, "calouro.painel@unifei.edu.br", "Calouro Painel");
  await page.goto("/painel");

  const minhas = page.getByRole("region", { name: "Minhas candidaturas" });
  await expect(minhas).toContainText("Você ainda não se candidatou a nenhum processo.");
  await expect(minhas.getByRole("link", { name: "Ver processos abertos" })).toHaveAttribute("href", "/processos");

  const meus = page.getByRole("region", { name: "Meus projetos" });
  await expect(meus).toContainText("Você ainda não participa de nenhum projeto.");
  await expect(meus.getByRole("link", { name: "Publicar processo" })).toHaveAttribute("href", "/publicar");
});

test("painel com candidatura e projeto mostra etapa e números; o projeto mostra os do processo", async ({ page }) => {
  const email = "dupla.painel@unifei.edu.br";
  await loginAs(page, email, "Dupla Painel");
  const { opportunity: alheio } = await insertProcess({ title: "Processo alheio", internalSelectionEnabled: true });
  await insertApplication(alheio.id, email, "INTERVIEW");
  const { project } = await insertProcess({
    title: "Processo meu",
    internalSelectionEnabled: true,
    viewsCount: 42,
    externalClicksCount: 7,
    project: { name: "Projeto da Dupla" },
  });
  await addProjectMember(project.id, email, "OWNER");

  await page.goto("/painel");
  const minhas = page.getByRole("region", { name: "Minhas candidaturas" });
  await expect(minhas).toContainText("1 em andamento");
  await expect(minhas).toContainText("Processo alheio");
  await expect(minhas).toContainText("Entrevista");
  await expect(minhas.getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/minhas-candidaturas");

  const meus = page.getByRole("region", { name: "Meus projetos" });
  await expect(meus.getByRole("link", { name: /Projeto da Dupla/ })).toHaveAttribute("href", `/projetos/${project.id}`);
  await expect(meus).toContainText(
    "1 processo aberto · 0 candidatos em andamento · 42 visualizações · 7 cliques no edital",
  );

  await page.goto(`/projetos/${project.id}`);
  await expect(page.getByRole("main")).toContainText("42 visualizações · 7 cliques no edital");
});
