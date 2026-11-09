import { expect, type Page, test } from "@playwright/test";
import {
  addProjectMember,
  clearOpportunities,
  closeTestDb,
  daysFromNow,
  insertApplication,
  insertProcess,
  updateCustomQuestion,
} from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

test("sem sessão, Candidatar-se leva ao login com next", async ({ page }) => {
  const { opportunity } = await insertProcess({ title: "Processo com seleção", internalSelectionEnabled: true });
  await page.goto(`/processo/${opportunity.slug}`);
  // O login é avisado antes do clique.
  await expect(page.getByText("Para se candidatar, você entra com a sua conta Google @unifei.edu.br.")).toBeVisible();
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
  await expect(page.getByText("Responda à pergunta.")).toBeVisible();

  // O erro some assim que o campo é corrigido, antes de reenviar.
  await page.getByLabel("Por que você quer entrar?").fill("Quero aprender na prática.");
  await expect(page.getByText("Responda à pergunta.")).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar candidatura" }).click();
  await page.waitForURL(/\/minhas-candidaturas\?enviada=/);
  await expect(page.getByRole("heading", { name: "Minhas candidaturas" })).toBeVisible();
  // Fim da jornada: confirmação e o que acontece depois.
  const aviso = page.getByRole("region", { name: "Candidatura enviada" });
  await expect(aviso).toContainText("Processo com pergunta");
  await expect(aviso).toContainText("e-mail a cada mudança de etapa");
  await expect(page.getByRole("link", { name: "Processo com pergunta" })).toBeVisible();
  // Funil: onde a candidatura está e o que vem depois.
  const funil = page.getByRole("list", { name: "Etapas da candidatura" });
  await expect(funil.getByRole("listitem")).toHaveText([/Inscrito/, /Em análise/, /Entrevista/, /Resultado/]);
  await expect(funil.locator('[aria-current="step"]')).toContainText("Inscrito");

  // Na página do processo, o botão vira "Ver minha candidatura" e o aviso de login some.
  await page.goto(`/processo/${opportunity.slug}`);
  await expect(page.getByText("Para se candidatar, você entra com")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver minha candidatura" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Candidatar-se" })).toHaveCount(0);

  await page.goto(`/processo/${opportunity.slug}/candidatar`);
  await expect(page.getByText("Você já se candidatou a este processo.")).toBeVisible();
});

test("pergunta criada com o formulário aberto: avisa para recarregar", async ({ page }) => {
  const { opportunity } = await insertProcess({ title: "Processo que ganha pergunta", internalSelectionEnabled: true });
  await loginAs(page, "recarrega.e2e@unifei.edu.br", "Recarrega E2E");
  await page.goto(`/processo/${opportunity.slug}/candidatar`);
  await page.getByRole("combobox", { name: "Curso" }).click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Período").fill("3");

  await updateCustomQuestion(opportunity.id, "Por que você quer entrar?");
  await page.getByRole("button", { name: "Enviar candidatura" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Recarregue a página" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Por que você quer entrar?")).toBeVisible();
});

test("com candidaturas, a pergunta fica somente leitura e o processo ainda salva", async ({ page }) => {
  const { project, opportunity } = await insertProcess({
    title: "Processo com pergunta fixa",
    internalSelectionEnabled: true,
    customQuestion: "Por que você quer entrar?",
  });
  await loginAs(page, "fixa.aluno@unifei.edu.br", "Aluno");
  await insertApplication(opportunity.id, "fixa.aluno@unifei.edu.br");
  await loginAs(page, "fixa.dona@unifei.edu.br", "Dona");
  await addProjectMember(project.id, "fixa.dona@unifei.edu.br", "OWNER");

  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/editar`);
  const question = page.getByLabel("Pergunta para os candidatos");
  await expect(question).toHaveValue("Por que você quer entrar?");
  await expect(question).toHaveAttribute("readonly", "");
  await expect(page.getByText("A pergunta não pode mudar depois das primeiras candidaturas.")).toBeVisible();

  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(new RegExp(`/projetos/${project.id}\\?atualizado=${opportunity.id}$`));
  await expect(page.getByRole("region", { name: "Alterações salvas" })).toBeVisible();
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

test("aluno retira a candidatura em andamento e pode se candidatar de novo; com resultado, não", async ({ page }) => {
  const email = "retira.e2e@unifei.edu.br";
  const { opportunity: aberto } = await insertProcess({
    title: "Processo em andamento",
    internalSelectionEnabled: true,
  });
  const { opportunity: decidido } = await insertProcess({ title: "Processo decidido", internalSelectionEnabled: true });
  await loginAs(page, email, "Aluno que retira");
  await insertApplication(aberto.id, email, "INTERVIEW");
  await insertApplication(decidido.id, email, "ACCEPTED");

  await page.goto("/minhas-candidaturas");
  await expect(page.getByRole("button", { name: "Retirar candidatura (Processo decidido)" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retirar candidatura (Processo em andamento)" }).click();

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Processo em andamento");
  await expect(confirm).toContainText("A equipe deixa de ver seus dados e a sua resposta.");
  await confirm.getByRole("button", { name: "Manter" }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole("link", { name: "Processo em andamento" })).toBeVisible();

  await page.getByRole("button", { name: "Retirar candidatura (Processo em andamento)" }).click();
  await confirm.getByRole("button", { name: "Retirar candidatura" }).click();
  await expect(page.getByRole("status")).toHaveText("Candidatura retirada.");
  await expect(page.getByRole("link", { name: "Processo em andamento" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Processo decidido" })).toBeVisible();

  await page.goto(`/processo/${aberto.slug}`);
  await expect(page.getByRole("link", { name: "Candidatar-se" })).toBeVisible();
});
