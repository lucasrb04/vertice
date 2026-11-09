import { expect, type Page, test } from "@playwright/test";

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

test("entrar, ver painel, sair", async ({ page }) => {
  await loginAs(page, "aluno.teste@unifei.edu.br", "Aluno Teste");
  await page.goto("/painel");
  await expect(page.getByRole("heading", { name: "Olá, Aluno Teste" })).toBeVisible();
  await page.getByRole("button", { name: "Menu da conta de Aluno Teste" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar$/);
});

test("erro de login volta a /entrar mantendo next", async ({ page }) => {
  await page.goto("/entrar?next=%2Fprocesso%2Fabc%2Fcandidatar&error=SOMETHING");
  await expect(page.getByRole("alert")).toBeVisible();
  const signIn = page.waitForRequest("**/api/auth/sign-in/social");
  await page.route("**/accounts.google.com/**", (route) => route.abort());
  await page.getByRole("main").getByRole("button", { name: "Entrar com Google" }).click();
  const request = await signIn;
  const { callbackURL, errorCallbackURL } = request.postDataJSON();
  expect(callbackURL).toBe("/processo/abc/candidatar");
  expect(errorCallbackURL).toBe("/entrar?next=%2Fprocesso%2Fabc%2Fcandidatar");
  // O Better-Auth valida as duas URLs: a resposta tem de aceitar, não só o navegador enviar.
  expect((await request.response())?.status()).toBe(200);
});

test("usuário comum vê 404 em /admin", async ({ page }) => {
  await loginAs(page, "comum@unifei.edu.br", "Comum");
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("rota inexistente usa a mesma página 404 de /admin", async ({ page }) => {
  const res = await page.goto("/rota-que-nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("fontes da identidade Ipê: Bricolage nos títulos e Figtree no texto", async ({ page }) => {
  await page.goto("/rota-que-nao-existe");
  const family = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await family("h1")).toMatch(/Bricolage Grotesque/);
  expect(await family("body")).toMatch(/Figtree/);
});

test("admin inicial vê o portal", async ({ page }) => {
  await loginAs(page, "admin@unifei.edu.br", "Admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Portal do administrador" })).toBeVisible();
});

test("login de teste com Gmail é recusado", async ({ page }) => {
  const res = await page.request.post("/api/test-auth/login", { data: { email: "x@gmail.com", name: "X" } });
  expect(res.status()).toBe(403);
});

test("/entrar mostra a mensagem do código de erro", async ({ page }) => {
  await page.goto("/entrar?error=DOMAIN_NOT_ALLOWED");
  await expect(page.getByText("Use sua conta @unifei.edu.br.")).toBeVisible();
  await page.goto("/entrar?error=ACCOUNT_SUSPENDED");
  await expect(page.getByText("Conta suspensa. Fale com a administração do Vértice.")).toBeVisible();
});

test("visitante em /painel vai para /entrar", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar$/);
});

test("/entrar mapeia o código do Better-Auth para hd divergente", async ({ page }) => {
  // Google com `hd` divergente: getUserInfo devolve null e o Better-Auth redireciona com este código.
  await page.goto("/entrar?error=unable_to_get_user_info");
  await expect(page.getByText("Use sua conta @unifei.edu.br.")).toBeVisible();
});

test("/entrar com código desconhecido mostra mensagem genérica sem refletir o valor", async ({ page }) => {
  await page.goto("/entrar?error=<b>xyz_inesperado</b>");
  await expect(page.getByText("Não foi possível entrar. Tente novamente.")).toBeVisible();
  await expect(page.getByText("xyz_inesperado")).toHaveCount(0);
});
