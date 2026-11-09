import { expect, type Locator, type Page, test } from "@playwright/test";
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

test("o quadro fica alinhado ao cabeçalho", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { project, opportunity } = await boardWithTwoCandidates(page);
  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);
  const header = await page.getByRole("banner").locator("> div > div").boundingBox();
  const title = await page.getByRole("heading", { level: 1, name: "Candidatos" }).boundingBox();
  const firstColumn = await page.getByRole("region", { name: /^Inscrito/ }).boundingBox();
  expect(Math.abs(title!.x - header!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(firstColumn!.x - header!.x)).toBeLessThanOrEqual(1);
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
    await p.getByRole("dialog").getByRole("button", { name: "Mover e avisar" }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Enviar resultado" }).click();
    await expect(p.getByRole("status")).toHaveText(expected);
  }
  await expect(inColumn(page, "Aprovado", ana.name)).toBeVisible();
});

test("celular: colunas em lista, sem rolagem horizontal da página", async ({ page }) => {
  const { project, opportunity } = await boardWithTwoCandidates(page);
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);
  await expect(page.getByRole("heading", { name: "Inscrito" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("800 px: quadro rola por dentro, sem rolagem horizontal da página", async ({ page }) => {
  const id = seq++;
  const { project, opportunity } = await insertProcess({ title: "Processo largo", internalSelectionEnabled: true });
  for (const [name, status] of [
    ["Ana", "ACCEPTED"],
    ["Bia", "REJECTED"],
  ] as const) {
    const email = `${name.toLowerCase()}.largo.${id}@unifei.edu.br`;
    await loginAs(page, email, `${name} Larga ${id}`);
    await insertApplication(opportunity.id, email, status);
  }
  const reviewer = `revisora.largo.${id}@unifei.edu.br`;
  await loginAs(page, reviewer, "Revisora");
  await addProjectMember(project.id, reviewer, "REVIEWER");

  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);
  await expect(inColumn(page, "Aprovado", `Ana Larga ${id}`)).toBeAttached();
  await expect(inColumn(page, "Não selecionado", `Bia Larga ${id}`)).toBeAttached();
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test("candidato que virou REVIEWER vê o próprio card sem controles", async ({ page }) => {
  const { project, opportunity, ana, bia } = await boardWithTwoCandidates(page);
  await loginAs(page, ana.email, ana.name);
  await addProjectMember(project.id, ana.email, "REVIEWER");
  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);

  await expect(page.getByText("Sua candidatura")).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: `Selecionar ${ana.name}` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Mover para (${ana.name})` })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: `Selecionar ${bia.name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Mover para (${bia.name})` })).toBeVisible();

  await page.getByRole("button", { name: `Mover para (${bia.name})` }).click();
  await expect(page.getByRole("dialog")).toContainText(
    `${bia.name} recebe um e-mail com a nova etapa e a sua mensagem assim que você mover.`,
  );
});

test("resultado pede confirmação antes do e-mail e Não selecionado sugere um texto gentil", async ({ page }) => {
  const { project, opportunity, ana, bia } = await boardWithTwoCandidates(page);
  await page.goto(`/projetos/${project.id}/processos/${opportunity.id}/candidatos`);

  await page.getByRole("button", { name: `Mover para (${ana.name})` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Etapa de destino" }).click();
  // Etapa intermediária: sem texto sugerido.
  await page.getByRole("option", { name: "Entrevista" }).click();
  await expect(dialog.getByRole("button", { name: "Usar texto sugerido" })).toHaveCount(0);
  await dialog.getByRole("combobox", { name: "Etapa de destino" }).click();
  await page.getByRole("option", { name: "Não selecionado" }).click();
  await dialog.getByRole("button", { name: "Usar texto sugerido" }).click();
  const message = dialog.getByLabel("Mensagem ao candidato");
  await expect(message).toHaveValue(/^Obrigado pelo interesse/);
  await message.press("End");
  await message.pressSequentially(" Abraços, equipe.");

  await dialog.getByRole("button", { name: "Mover e avisar" }).click();
  await expect(dialog.getByRole("heading", { name: "Confirmar resultado" })).toBeVisible();
  await expect(dialog).toContainText(`${ana.name} passa para Não selecionado e recebe o e-mail agora.`);
  await expect(dialog).toContainText("Abraços, equipe.");
  await expect(dialog).toContainText("O e-mail não pode ser desfeito.");
  // O foco vai para o passo seguro: dois Enter seguidos não enviam o resultado.
  await expect(dialog.getByRole("button", { name: "Voltar" })).toBeFocused();
  // Voltar mantém o que foi escrito.
  await page.keyboard.press("Enter");
  await expect(message).toHaveValue(/Abraços, equipe\.$/);
  await expect(dialog.getByRole("button", { name: "Mover e avisar" })).toBeFocused();
  await dialog.getByRole("button", { name: "Mover e avisar" }).click();
  await dialog.getByRole("button", { name: "Enviar resultado" }).click();

  await expect(page.getByRole("status")).toHaveText("1 candidato movido.");
  await expect(inColumn(page, "Não selecionado", ana.name)).toBeVisible();

  // Em lote, o diálogo fala de cada um.
  await page.getByRole("checkbox", { name: `Selecionar ${bia.name}` }).click();
  await page.getByRole("checkbox", { name: `Selecionar ${ana.name}` }).click();
  await page.getByRole("button", { name: "Mover selecionados" }).click();
  await expect(dialog).toContainText("Cada candidato recebe um e-mail com a nova etapa e a sua mensagem");
});

test("arquivar cita os candidatos em andamento e o aluno vê Projeto arquivado", async ({ page }) => {
  const { project, ana, opportunity } = await boardWithTwoCandidates(page);
  const owner = `dona.${seq++}@unifei.edu.br`;
  await loginAs(page, owner, "Dona");
  await addProjectMember(project.id, owner, "OWNER");

  await page.goto(`/projetos/${project.id}`);
  await page.getByRole("button", { name: "Arquivar projeto" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("2 candidatos ainda em andamento");
  await dialog.getByRole("button", { name: "Arquivar" }).click();
  await expect(dialog).toBeHidden();

  await loginAs(page, ana.email, ana.name);
  await page.goto("/minhas-candidaturas");
  await expect(page.getByRole("link", { name: opportunity.title })).toBeVisible();
  await expect(page.getByText("Projeto arquivado")).toBeVisible();
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
