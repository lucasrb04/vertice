import { expect, test, type Page } from "@playwright/test";
import { addProjectMember, clearOpportunities, closeTestDb, insertProcess } from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

test("logado denuncia um processo, vê a confirmação e o foco volta ao botão", async ({ page }) => {
  const { opportunity } = await insertProcess({ title: "Processo denunciável" });
  await loginAs(page, "denuncia.e2e@unifei.edu.br", "Denuncia E2E");
  await page.goto(`/processo/${opportunity.slug}`);

  const trigger = page.getByRole("button", { name: "Denunciar" });
  await trigger.click();
  const dialog = page.getByRole("dialog");

  // Sem motivo, o formulário pede um antes de enviar.
  await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(dialog.getByText("Escolha um motivo.")).toBeVisible();

  await dialog.getByRole("combobox", { name: "Motivo" }).click();
  await page.getByRole("option", { name: "Informação falsa" }).click();
  await dialog.getByLabel("Descrição").fill("A bolsa anunciada não existe.");
  await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(dialog.getByText("Recebemos sua denúncia.")).toBeVisible();

  await dialog.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Repetida: a mesma resposta.
  await trigger.click();
  await page.getByRole("combobox", { name: "Motivo" }).click();
  await page.getByRole("option", { name: "Spam" }).click();
  await page.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(page.getByRole("dialog").getByText("Recebemos sua denúncia.")).toBeVisible();
});

test("visitante sem sessão não vê o botão Denunciar", async ({ page }) => {
  const { project, opportunity } = await insertProcess({ title: "Processo sem sessão" });
  await page.goto(`/processo/${opportunity.slug}`);
  await expect(page.getByRole("heading", { name: "Processo sem sessão" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Denunciar" })).toHaveCount(0);
  await page.goto(`/projeto/${project.slug}`);
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  await expect(page.getByRole("button", { name: "Denunciar" })).toHaveCount(0);
});

test("membro do projeto não vê o botão; quem não é membro vê também na página do projeto", async ({ page }) => {
  const { project, opportunity } = await insertProcess({ title: "Processo da equipe" });
  await loginAs(page, "membro.denuncia.e2e@unifei.edu.br", "Membro E2E");
  await addProjectMember(project.id, "membro.denuncia.e2e@unifei.edu.br", "REVIEWER");
  await page.goto(`/processo/${opportunity.slug}`);
  await expect(page.getByRole("heading", { name: "Processo da equipe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Denunciar" })).toHaveCount(0);
  await page.goto(`/projeto/${project.slug}`);
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  await expect(page.getByRole("button", { name: "Denunciar" })).toHaveCount(0);

  await loginAs(page, "outro.denuncia.e2e@unifei.edu.br", "Outro E2E");
  await page.goto(`/projeto/${project.slug}`);
  await expect(page.getByRole("button", { name: "Denunciar" })).toBeVisible();
});
