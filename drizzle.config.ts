import { defineConfig } from "drizzle-kit";

// Carrega .env local (gitignored) quando existir; em CI/produção as variáveis vêm do ambiente.
try {
  process.loadEnvFile(".env");
} catch {
  // sem .env: usa o ambiente
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
