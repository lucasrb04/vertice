import { expect, test, type Page } from "@playwright/test";
import { clearOpportunities, closeTestDb, daysFromNow, insertProcess } from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

test("sem sessão, Candidatar-se leva ao login com next", async ({ page }) => {
  const { opportunity } = await insertProcess({ title: "Processo com seleção", internalSelectionEnabled: true });
  await page.goto(`/processo/${opportunity.slug}`);
  await page.getByRole("link", { name: "Candidatar-se" }).click();
  await expect(page).toHaveURL(/\/entrar\?next=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get("next")!)).toBe(
    `/processo/${opportunity.slug}/candidatar`,
  );
});

test("com sessão, preenche o perfil, responde e envia", async ({ page }) => {
  const { opportunity } = await insertProcess({
    title: "Processo com pergunta",
    internalSelectionEnabled: true,
    customQuestion: "Por que você quer entrar?",
    minSemester: 6,
  });
  await loginAs(page, "candidato.e2e@unifei.edu.br", "Candidato E2E");
  await page.goto(`/processo/${opportunity.slug}/candidatar`);

  await page.getByRole("combobox", { name: "Curso" }).click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Período").fill("3");
  await expect(page.getByRole("status")).toContainText("a partir do 6º período");

  // Sem resposta, o servidor recusa e o texto digitado fica.
  await page.getByLabel("Link de perfil").fill("https://github.com/candidato");
  await page.getByRole("button", { name: "Enviar candidatura" }).click();
  await expect(page.getByText("Revise os campos destacados.")).toBeVisible();
  await expect(page.getByLabel("Link de perfil")).toHaveValue("https://github.com/candidato");

  await page.getByLabel("Por que você quer entrar?").fill("Quero aprender na prática.");
  await page.getByRole("button", { name: "Enviar candidatura" }).click();
  await page.waitForURL(/\/minhas-candidaturas/);
  await expect(page.getByRole("heading", { name: "Minhas candidaturas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Processo com pergunta" })).toBeVisible();
  await expect(page.getByText("Inscrito")).toBeVisible();

  // Na página do processo, o botão vira "Ver minha candidatura".
  await page.goto(`/processo/${opportunity.slug}`);
  await expect(page.getByRole("link", { name: "Ver minha candidatura" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Candidatar-se" })).toHaveCount(0);

  await page.goto(`/processo/${opportunity.slug}/candidatar`);
  await expect(page.getByText("Você já se candidatou a este processo.")).toBeVisible();
});

test("antes da abertura o botão fica desabilitado", async ({ page }) => {
  const day = daysFromNow(5).toISOString().slice(0, 10);
  const { opportunity } = await insertProcess({
    title: "Processo que abre depois",
    internalSelectionEnabled: true,
    applicationsOpenOn: day,
  });
  await page.goto(`/processo/${opportunity.slug}`);
  const button = page.getByRole("button", { name: /Candidaturas abrem em/ });
  await expect(button).toBeDisabled();
  await expect(page.getByRole("link", { name: "Candidatar-se" })).toHaveCount(0);
});
