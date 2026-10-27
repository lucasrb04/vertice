import { test, expect, type Page } from "@playwright/test";

async function loginAs(page: Page, email: string, name: string) {
  const res = await page.request.post("/api/test-auth/login", { data: { email, name } });
  expect(res.status()).toBe(200);
}

test("entrar, ver painel, sair", async ({ page }) => {
  await loginAs(page, "aluno.teste@unifei.edu.br", "Aluno Teste");
  await page.goto("/painel");
  await expect(page.getByRole("heading", { name: "Olá, Aluno Teste" })).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar$/);
});

test("usuário comum vê 404 em /admin", async ({ page }) => {
  await loginAs(page, "comum@unifei.edu.br", "Comum");
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
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
