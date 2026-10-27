import { getEnv } from "@/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      getEnv();
    } catch (err) {
      // Configuração inválida (ex.: ENABLE_TEST_AUTH em produção): o servidor não pode subir.
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
}
