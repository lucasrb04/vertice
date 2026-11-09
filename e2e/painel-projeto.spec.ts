import { type Browser, expect, type Page, test } from "@playwright/test";
import { SYSTEM_ADMIN_READ_ONLY } from "../src/lib/projects/labels";
import { MEMBER_NO_ACCOUNT } from "../src/lib/projects/members";
import { formatDay, todayInSaoPaulo } from "../src/lib/time";
import { addProcess, closeTestDb, insertReport } from "./helpers";

test.afterAll(closeTestDb);

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

/** Hoje + `days` no fuso de Brasília, como YYYY-MM-DD (valor de `<input type="date">`). */
function dayInSaoPaulo(days: number): string {
  const d = new Date(`${todayInSaoPaulo()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cria projeto + processo pelo wizard (mesmos passos do E2E da Task 9) e devolve o uuid do projeto. */
async function publishProject(page: Page, projectName: string, opportunityTitle: string): Promise<string> {
  await page.goto("/publicar?novo=1");
  await page.getByLabel("Nome do projeto").fill(projectName);
  await page.getByRole("combobox", { name: "Categoria" }).click();
  await page.getByRole("option", { name: "Projeto especial" }).click();
  await page.getByLabel("Descrição curta").fill("Equipe de competição de veículos off-road.");
  await page.getByLabel("E-mail de contato").fill("contato@equipe.com");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Título do processo").fill(opportunityTitle);
  await page.getByLabel("Descrição das atividades").fill("Projetar e montar o sistema de suspensão.");
  await page.getByLabel("Prazo final de inscrição").fill(dayInSaoPaulo(10));
  await page.getByLabel("Link do edital ou formulário").fill("https://unifei.edu.br/edital.pdf");
  await page.getByRole("button", { name: "Publicar" }).click();

  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}\?publicado=[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: projectName })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function addMemberByEmail(page: Page, projectId: string, email: string, roleLabel: "Administrador" | "Revisor") {
  await page.goto(`/projetos/${projectId}/membros`);
  await page.getByLabel("E-mail da pessoa").fill(email);
  await page.getByRole("combobox", { name: "Papel" }).click();
  await page.getByRole("option", { name: roleLabel }).click();
  await page.getByRole("button", { name: "Adicionar" }).click();
}

test("encerrar processo move para Encerrados", async ({ page }) => {
  await loginAs(page, "dono.encerrar@unifei.edu.br", "Dono Encerrar");
  await publishProject(page, "Projeto Encerrar", "Processo para encerrar");

  const abertos = page.getByRole("region", { name: "Abertos" });
  await expect(abertos.getByText("Processo para encerrar")).toBeVisible();
  // Sem encerrados, a seção já diz isso, sem um "+" que abre para nada.
  const vazio = page.getByRole("region", { name: "Encerrados" });
  await expect(vazio.getByText("Nenhum processo encerrado.")).toBeVisible();
  await expect(vazio.locator("summary")).toHaveCount(0);
  // A ação irreversível fica por último, longe de Editar e Duplicar.
  await expect(abertos.getByRole("listitem").first().locator("a, button")).toHaveText([
    "Editar",
    "Duplicar",
    "Encerrar agora",
  ]);
  await abertos.getByRole("button", { name: "Encerrar agora" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Encerrar processo" }).click();

  await expect(abertos.getByText("Processo para encerrar")).toHaveCount(0);
  const encerrados = page.getByRole("region", { name: "Encerrados" });
  await encerrados.locator("summary").click();
  await expect(encerrados.getByText("Processo para encerrar")).toBeVisible();
  await expect(encerrados.getByText(`Encerrado em ${formatDay(todayInSaoPaulo())}`)).toBeVisible();
});

test("duplicar abre formulário pré-preenchido sem prazo", async ({ page }) => {
  await loginAs(page, "dono.duplicar@unifei.edu.br", "Dono Duplicar");
  await publishProject(page, "Projeto Duplicar", "Processo para duplicar");

  // Editar: adiciona uma tag existente e salva.
  await page.getByRole("region", { name: "Abertos" }).getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL(/\/processos\/[0-9a-f-]{36}\/editar$/);
  await page.getByRole("main").getByText("Tags", { exact: true }).click();
  const tema = page.getByRole("combobox", { name: "Tema" });
  await tema.fill("python");
  await expect(page.getByRole("option", { name: "Python" })).toBeVisible();
  await tema.press("Enter");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}\?atualizado=[0-9a-f-]{36}$/);
  await expect(page.getByRole("region", { name: "Alterações salvas" })).toBeVisible();

  await page.getByRole("region", { name: "Abertos" }).getByRole("link", { name: "Duplicar" }).click();
  await expect(page).toHaveURL(/\/processos\/novo\?duplicar=[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Título do processo")).toHaveValue("Processo para duplicar");
  await expect(page.getByLabel("Link do edital ou formulário")).toHaveValue("https://unifei.edu.br/edital.pdf");
  await expect(page.getByLabel("Prazo final de inscrição")).toHaveValue("");
  // A tag copiada aparece com o nome, não como "Tag".
  await page.getByRole("main").getByText("Tags", { exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Tags escolhidas: Tema" }).getByText("Python", { exact: true }),
  ).toBeVisible();
});

test("REVIEWER vê o painel sem botões de edição", async ({ page, browser }) => {
  // O revisor entra uma vez para ter conta.
  const reviewerContext = await browser.newContext();
  const reviewer = await reviewerContext.newPage();
  await loginAs(reviewer, "revisor@unifei.edu.br", "Revisor");

  await loginAs(page, "dono.revisor@unifei.edu.br", "Dono Revisor");
  const projectId = await publishProject(page, "Projeto Revisor", "Processo visto pelo revisor");
  await addMemberByEmail(page, projectId, "revisor@unifei.edu.br", "Revisor");
  await expect(
    page.getByRole("region", { name: "Membros do projeto" }).getByText("revisor@unifei.edu.br"),
  ).toBeVisible();

  await reviewer.goto(`/projetos/${projectId}`);
  const main = reviewer.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Projeto Revisor" })).toBeVisible();
  await expect(main.getByText("Processo visto pelo revisor")).toBeVisible();
  for (const name of ["Editar", "Encerrar agora", "Duplicar", "Novo processo", "Editar projeto", "Arquivar projeto"]) {
    await expect(main.getByRole("link", { name, exact: true })).toHaveCount(0);
    await expect(main.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(main.getByRole("link", { name: "Membros", exact: true })).toBeVisible();

  // Revisor não acessa as páginas de edição.
  const res = await reviewer.goto(`/projetos/${projectId}/editar`);
  expect(res?.status()).toBe(404);
  await reviewerContext.close();
});

test("e-mail sem conta mostra mensagem orientadora", async ({ page }) => {
  await loginAs(page, "dono.membros@unifei.edu.br", "Dono Membros");
  const projectId = await publishProject(page, "Projeto Membros", "Processo dos membros");
  await addMemberByEmail(page, projectId, "ninguem@unifei.edu.br", "Administrador");
  await expect(page.getByText(MEMBER_NO_ACCOUNT)).toBeVisible();
});

test("/painel lista Meus projetos", async ({ page }) => {
  await loginAs(page, "dono.painel@unifei.edu.br", "Dono Painel");
  await page.goto("/painel");
  await expect(page.getByRole("heading", { name: "Olá, Dono Painel" })).toBeVisible();
  await expect(page.getByText("Você ainda não participa de nenhum projeto.")).toBeVisible();

  const projectId = await publishProject(page, "Projeto do Painel", "Processo do painel");
  await page.goto("/painel");
  const meus = page.getByRole("region", { name: "Meus projetos" });
  await expect(meus.getByRole("link", { name: /Projeto do Painel/ })).toHaveAttribute("href", `/projetos/${projectId}`);
  await expect(meus.getByText("Dono", { exact: true })).toBeVisible();
  await meus.getByRole("link", { name: "Publicar processo" }).click();
  await expect(page).toHaveURL(/\/publicar$/);
});

test("menu da conta leva de volta à gestão do projeto depois de publicar", async ({ page }) => {
  await loginAs(page, "dono.menu@unifei.edu.br", "Dono do Menu");
  const projectId = await publishProject(page, "Projeto do Menu", "Processo do menu");
  await page.goto("/processos");

  const menuButton = page.getByRole("banner").getByRole("button", { name: "Menu da conta de Dono do Menu" });
  await menuButton.click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("dono.menu@unifei.edu.br");
  await expect(menu.getByRole("menuitem", { name: "Administração" })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Painel" }).click();

  await page.waitForURL("/painel");
  await page.getByRole("link", { name: /Projeto do Menu/ }).click();
  await page.waitForURL(`/projetos/${projectId}`);

  // Teclado: Enter abre, seta desce, Esc fecha e devolve o foco ao botão.
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(menuButton).toBeFocused();
});

test("menu da conta mostra Administração só para admin", async ({ page }) => {
  await loginAs(page, "admin@unifei.edu.br", "Admin");
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Menu da conta de Admin" }).click();
  await page.getByRole("menuitem", { name: "Administração" }).click();
  await page.waitForURL("/admin");
});

test("aviso de publicação só aparece para processo aberto do próprio projeto", async ({ page }) => {
  await loginAs(page, "dono.aviso@unifei.edu.br", "Dono do Aviso");
  const projectId = await publishProject(page, "Projeto do Aviso", "Processo do aviso");
  await expect(page.getByRole("region", { name: "Processo publicado" })).toBeVisible();

  // Id inventado ou de outro projeto na URL: nenhum aviso, nada é refletido.
  await page.goto(`/projetos/${projectId}?publicado=00000000-0000-4000-8000-000000000000`);
  await expect(page.getByRole("heading", { level: 1, name: "Projeto do Aviso" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Processo publicado" })).toHaveCount(0);
  await page.goto(`/projetos/${projectId}?publicado=nao-e-uuid`);
  await expect(page.getByRole("region", { name: "Processo publicado" })).toHaveCount(0);
});

test("painel de projeto alheio é 404", async ({ page, browser }) => {
  await loginAs(page, "dono.alheio@unifei.edu.br", "Dono Alheio");
  const projectId = await publishProject(page, "Projeto Alheio", "Processo alheio");

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await loginAs(other, "intruso@unifei.edu.br", "Intruso");
  for (const path of ["", "/editar", "/membros", "/processos/novo"]) {
    const res = await other.goto(`/projetos/${projectId}${path}`);
    expect(res?.status()).toBe(404);
    await expect(other.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  }
  await otherContext.close();

  // SYSTEM_ADMIN sem membership vê o painel só para leitura e não abre as páginas de edição.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAs(admin, "admin@unifei.edu.br", "Admin");
  await admin.goto(`/projetos/${projectId}`);
  const main = admin.getByRole("main");
  await expect(main.getByText(SYSTEM_ADMIN_READ_ONLY)).toBeVisible();
  await expect(main.getByText("Processo alheio")).toBeVisible();
  await expect(main.getByRole("link", { name: "Novo processo", exact: true })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Encerrar agora", exact: true })).toHaveCount(0);
  for (const path of ["/editar", "/processos/novo"]) {
    const res = await admin.goto(`/projetos/${projectId}${path}`);
    expect(res?.status()).toBe(404);
  }
  await adminContext.close();
});

/** Oculta pelo portal do admin, que chama `hideTarget` de verdade. */
async function hideAsAdmin(browser: Browser, name: string, reason: string) {
  const context = await browser.newContext();
  const admin = await context.newPage();
  await loginAs(admin, "admin@unifei.edu.br", "Admin");
  await admin.goto(`/admin?q=${encodeURIComponent(name)}`);
  await admin.getByRole("button", { name: `Ocultar: ${name}`, exact: true }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Motivo").fill(reason);
  await dialog.getByRole("button", { name: "Ocultar", exact: true }).click();
  await expect(admin.getByRole("status")).toContainText("Item ocultado.");
  await context.close();
}

test("membro vê o aviso e o motivo de um projeto oculto pela moderação", async ({ page, browser }) => {
  await loginAs(page, "dono.oculto@unifei.edu.br", "Dono Oculto");
  const projectId = await publishProject(page, "Projeto Oculto Pelo Admin", "Processo do oculto");

  await hideAsAdmin(browser, "Projeto Oculto Pelo Admin", "Conteúdo fora das regras da plataforma.");
  await page.goto(`/projetos/${projectId}`);
  const notice = page.getByRole("status").filter({ hasText: "Oculto pela moderação" });
  await expect(notice).toContainText("Conteúdo fora das regras da plataforma.");
  await expect(page.getByRole("link", { name: "Novo processo", exact: true })).toHaveCount(0);
});

test("processo oculto: motivo no painel, sem editar nem duplicar, Kanban só leitura", async ({ page, browser }) => {
  await loginAs(page, "dono.processo.oculto@unifei.edu.br", "Dono Processo Oculto");
  const projectId = await publishProject(page, "Projeto Com Processo Oculto", "Processo que segue no ar");
  await addProcess(projectId, { title: "Processo oculto pelo admin", internalSelectionEnabled: true });

  await hideAsAdmin(browser, "Processo oculto pelo admin", "A bolsa anunciada não existe.");
  await page.goto(`/projetos/${projectId}`);
  // Sem aviso de projeto: só o processo saiu do ar.
  await expect(page.getByRole("status").filter({ hasText: "Oculto pela moderação" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Abertos" }).getByText("Processo oculto pelo admin")).toHaveCount(0);

  const encerrados = page.getByRole("region", { name: "Encerrados" });
  await encerrados.locator("summary").click();
  const row = encerrados.getByRole("listitem").filter({ hasText: "Processo oculto pelo admin" });
  await expect(row.getByText("Oculto pela moderação")).toBeVisible();
  await expect(row.getByText("A bolsa anunciada não existe.")).toBeVisible();
  await expect(row.getByRole("link", { name: "Duplicar" })).toHaveCount(0);
  await expect(row.getByRole("link", { name: "Editar" })).toHaveCount(0);

  await row.getByRole("link", { name: /Candidatos/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Este processo está oculto pela moderação." })).toBeVisible();
});

test("processo oculto por denúncias mostra o aviso da comunidade no painel", async ({ page, browser }) => {
  await loginAs(page, "dono.denunciado@unifei.edu.br", "Dono Denunciado");
  const projectId = await publishProject(page, "Projeto Denunciado", "Processo de controle");
  const opportunity = await addProcess(projectId, { title: "Processo denunciado pela comunidade" });

  // Quatro denúncias de usuários distintos; a quinta pela página, que dispara a revisão automática.
  const context = await browser.newContext();
  const reporter = await context.newPage();
  for (let i = 0; i < 4; i++) {
    const email = `denunciante.painel${i}@unifei.edu.br`;
    await loginAs(reporter, email, `Denunciante ${i}`);
    await insertReport({ targetType: "OPPORTUNITY", targetId: opportunity.id }, email);
  }
  await loginAs(reporter, "denunciante.painel4@unifei.edu.br", "Denunciante 4");
  await reporter.goto(`/processo/${opportunity.slug}`);
  await reporter.getByRole("button", { name: "Denunciar" }).click();
  const dialog = reporter.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Motivo" }).click();
  await reporter.getByRole("option", { name: "Spam" }).click();
  await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(dialog.getByText("Recebemos sua denúncia.")).toBeVisible();
  await context.close();

  await page.goto(`/projetos/${projectId}`);
  const encerrados = page.getByRole("region", { name: "Encerrados" });
  await encerrados.locator("summary").click();
  const row = encerrados.getByRole("listitem").filter({ hasText: "Processo denunciado pela comunidade" });
  await expect(row.getByText("Oculto pela moderação")).toBeVisible();
  await expect(row.getByText("Oculto após denúncias da comunidade.")).toBeVisible();
});
