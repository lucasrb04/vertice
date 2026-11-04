import { expect, test, type Page } from "@playwright/test";
import { clearOpportunities, closeTestDb, insertProcess, insertReport } from "./helpers";

test.beforeEach(clearOpportunities);
test.afterAll(closeTestDb);

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

const REASON = "Motivo registrado pelo teste E2E.";

/** Preenche o motivo e confirma só com o teclado: o campo recebe o foco, Tab passa por Cancelar até o botão. */
async function confirmWithKeyboard(page: Page, reason: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Motivo")).toBeFocused();
  await page.keyboard.type(reason);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
}

test("admin oculta e restaura um processo achado na busca, só com teclado", async ({ page, browser }) => {
  const { opportunity } = await insertProcess({ title: "Processo moderável" });
  await loginAs(page, "admin@unifei.edu.br", "Admin");

  await page.goto(`/processo/${opportunity.slug}`);
  await expect(page.getByRole("heading", { name: "Processo moderável" })).toBeVisible();

  await page.goto("/admin");
  await page.getByRole("searchbox", { name: "Nome do projeto ou do processo" }).focus();
  await page.keyboard.type("MODERAVEL");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=MODERAVEL/);

  const hide = page.getByRole("button", { name: "Ocultar: Processo moderável" });
  await hide.focus();
  await page.keyboard.press("Enter");
  // Motivo curto demais é recusado pelo navegador ou pelo servidor, e o diálogo continua aberto.
  await page.keyboard.type("curto");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByLabel("Motivo").fill("");
  await page.getByLabel("Motivo").focus();
  await confirmWithKeyboard(page, REASON);

  await expect(page.getByRole("status")).toContainText("Item ocultado.");
  await expect(page.getByText("Oculto pela moderação")).toBeVisible();

  // Some da vitrine e da página pública.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto("/processos");
  await expect(pub.getByText("Processo moderável")).toHaveCount(0);
  expect((await pub.goto(`/processo/${opportunity.slug}`))?.status()).toBe(404);

  // Só a ação válida: oculto oferece Restaurar, não Ocultar.
  await expect(page.getByRole("button", { name: "Ocultar: Processo moderável" })).toHaveCount(0);
  const restore = page.getByRole("button", { name: "Restaurar: Processo moderável" });
  await restore.focus();
  await page.keyboard.press("Enter");
  await confirmWithKeyboard(page, REASON);
  await expect(page.getByRole("status")).toContainText("Item restaurado.");

  await pub.goto("/processos");
  await expect(pub.getByText("Processo moderável")).toBeVisible();
  await visitor.close();
});

test("admin descarta denúncias e a fila esvazia; a fila não mostra quem denunciou", async ({ page, browser }) => {
  const { opportunity } = await insertProcess({ title: "Processo denunciado" });
  const reporterContext = await browser.newContext();
  const reporter = await reporterContext.newPage();
  await loginAs(reporter, "quem.denunciou.e2e@unifei.edu.br", "Quem Denunciou");
  await reporterContext.close();
  await insertReport(
    { targetType: "OPPORTUNITY", targetId: opportunity.id },
    "quem.denunciou.e2e@unifei.edu.br",
    "FALSE_INFO",
    "A bolsa anunciada não existe.",
  );

  await loginAs(page, "admin@unifei.edu.br", "Admin");
  await page.goto("/admin");
  const queue = page.getByRole("region", { name: "Fila de denúncias" });
  await expect(queue.getByRole("heading", { name: "Processo denunciado" })).toBeVisible();
  await expect(queue.getByText("1 denúncia")).toBeVisible();
  await expect(queue.getByText("Informação falsa (1)")).toBeVisible();
  await expect(queue.getByText("A bolsa anunciada não existe.")).toBeVisible();
  await expect(page.getByText("Quem Denunciou")).toHaveCount(0);
  await expect(page.getByText("quem.denunciou.e2e")).toHaveCount(0);

  const dismiss = page.getByRole("button", { name: "Descartar denúncias: Processo denunciado" });
  await dismiss.focus();
  await page.keyboard.press("Enter");
  await confirmWithKeyboard(page, REASON);

  await expect(page.getByRole("status")).toContainText("Denúncias descartadas.");
  await expect(queue.getByText("Nenhuma denúncia pendente.")).toBeVisible();
  await expect(queue.getByRole("heading", { name: "Processo denunciado" })).toHaveCount(0);
});
