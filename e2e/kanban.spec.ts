import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  addProjectMember,
  clearOpportunities,
  closeTestDb,
  insertApplication,
  insertProcess,
  updateProjectStatus,
} from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

let seq = 0;

async function loginAs(page: Page, email: string, name: string) {
  await page.context().clearCookies();
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

/** Processo com dois candidatos e um REVIEWER, deixando o navegador logado como o REVIEWER. */
async function boardWithTwoCandidates(page: Page) {
  const id = seq++;
  const { project, opportunity } = await insertProcess({ title: "Processo do quadro", internalSelectionEnabled: true });
  const ana = { email: `ana.${id}@unifei.edu.br`, name: `Ana Kanban ${id}` };
  const bia = { email: `bia.${id}@unifei.edu.br`, name: `Bia Kanban ${id}` };
  for (const student of [ana, bia]) {
    await loginAs(page, student.email, student.name);
    await insertApplication(opportunity.id, student.email);
  }
  const reviewer = `revisora.${id}@unifei.edu.br`;
  await loginAs(page, reviewer, "Revisora");
  await addProjectMember(project.id, reviewer, "REVIEWER");
  return { project, opportunity, ana, bia };
}

const column = (page: Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}`) });

const inColumn = (page: Page, name: string, student: string) =>
  column(page, name).getByRole("paragraph").filter({ hasText: student });

/** Só Tab: se o controle não for alcançável pelo teclado, o teste falha aqui. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Controle não alcançado com Tab.");
}

test("REVIEWER move dois candidatos para Entrevista com mensagem e o aluno vê", async ({ page }) => {
  const { project, ana, bia } = await boardWithTwoCandidates(page);

  await page.goto(`/projetos/${project.id}`);
  await page.getByRole("link", { name: "Candidatos (2)" }).click();
  await expect(page.getByRole("heading", { name: "Candidatos", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inscrito" })).toContainText("2");

  await page.getByRole("checkbox", { name: `Selecionar ${ana.name}` }).click();
  await page.getByRole("checkbox", { name: `Selecionar ${bia.name}` }).click();
  await page.getByRole("button", { name: "Mover selecionados" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Etapa de destino" }).click();
  await page.getByRole("option", { name: "Entrevista" }).click();
  await dialog.getByLabel("Mensagem ao candidato").fill("Entrevista na sexta, às 14h.");
  await dialog.getByRole("button", { name: "Mover" }).click();

  await expect(page.getByRole("status")).toHaveText("2 candidatos movidos.");
  await expect(dialog).toBeHidden();
  await expect(inColumn(page, "Entrevista", ana.name)).toBeVisible();
  await expect(inColumn(page, "Entrevista", bia.name)).toBeVisible();

  await page.locator("summary", { hasText: ana.name }).click();
  await expect(page.getByText(ana.email)).toBeVisible();
  await expect(page.locator("details[open]").getByText("Entrevista na sexta, às 14h.")).toBeVisible();

  await loginAs(page, ana.email, ana.name);
  await page.goto("/minhas-candidaturas");
  await expect(page.getByText("Etapa: Entrevista")).toBeVisible();
  await expect(page.getByText("Entrevista na sexta, às 14h.")).toBeVisible();
});

test("o fluxo completo funciona só com teclado", async ({ page }) => {
  const { project, opportunity, ana, bia } = await boardWithTwoCandidates(page);
  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);

  await tabTo(page, page.getByRole("checkbox", { name: `Selecionar ${ana.name}` }));
  await page.keyboard.press("Space");
  await tabTo(page, page.getByRole("checkbox", { name: `Selecionar ${bia.name}` }));
  await page.keyboard.press("Space");
  await expect(page.getByText("2 selecionados")).toBeVisible();

  // De volta ao botão da seleção, sem mouse.
  const moveSelected = page.getByRole("button", { name: "Mover selecionados" });
  for (let i = 0; i < 20 && !(await moveSelected.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Shift+Tab");
  }
  await expect(moveSelected).toBeFocused();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await tabTo(page, dialog.getByRole("combobox", { name: "Etapa de destino" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "Inscrito" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Em análise" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Entrevista" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("combobox", { name: "Etapa de destino" })).toHaveText("Entrevista");

  await tabTo(page, dialog.getByLabel("Mensagem ao candidato"));
  await page.keyboard.type("Pelo teclado.");
  await tabTo(page, dialog.getByRole("button", { name: "Mover" }));
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("2 candidatos movidos.");
  await expect(page.getByRole("status")).toBeFocused();
  await expect(inColumn(page, "Entrevista", ana.name)).toBeVisible();

  // Escape devolve o foco a quem abriu o diálogo.
  const moveOne = column(page, "Entrevista").getByRole("button", { name: `Mover para (${ana.name})` });
  await tabTo(page, moveOne);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(moveOne).toBeFocused();
});

test("movimento alheio não sobrescreve: a tela informa quem não mudou", async ({ page, context }) => {
  const { project, opportunity, ana } = await boardWithTwoCandidates(page);
  const url = `/projetos/${project.id}/processos/${opportunity.id}/candidatos`;
  await page.goto(url);
  const other = await context.newPage();
  await other.goto(url);

  for (const [p, stage, expected] of [
    [other, "Aprovado", "1 candidato movido."],
    [page, "Não selecionado", "Nenhum candidato movido. 1 não mudou: já estava na etapa ou outra pessoa moveu antes."],
  ] as const) {
    await p.getByRole("button", { name: `Mover para (${ana.name})` }).click();
    await p.getByRole("combobox", { name: "Etapa de destino" }).click();
    await p.getByRole("option", { name: stage }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Mover" }).click();
    await expect(p.getByRole("status")).toHaveText(expected);
  }
  await expect(inColumn(page, "Aprovado", ana.name)).toBeVisible();
});

test("celular: colunas em lista, sem rolagem horizontal da página", async ({ page }) => {
  const { project, opportunity } = await boardWithTwoCandidates(page);
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);
  await expect(page.getByRole("heading", { name: "Inscrito" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("projeto arquivado: só leitura", async ({ page }) => {
  const { project, opportunity, ana } = await boardWithTwoCandidates(page);
  await updateProjectStatus(project.id, "ARCHIVED");
  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);
  await expect(page.getByRole("paragraph").filter({ hasText: ana.name })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mover/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("quem não é membro recebe 404", async ({ page }) => {
  const { project, opportunity } = await boardWithTwoCandidates(page);
  await loginAs(page, "fora.kanban@unifei.edu.br", "De Fora");
  const res = await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);
  expect(res?.status()).toBe(404);
});
