/** Só permite operações destrutivas em bancos de teste: NODE_ENV=test e nome terminando em `_test`. */
export function assertTestDatabase(nodeEnv: string, databaseUrl: string): void {
  let dbName = "";
  try {
    dbName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  } catch {
    // URL inválida: cai na recusa abaixo.
  }
  if (nodeEnv !== "test" || !dbName.endsWith("_test")) {
    throw new Error(
      `resetDb recusado: exige NODE_ENV=test e banco terminado em "_test" (NODE_ENV=${nodeEnv}, banco="${dbName}").`,
    );
  }
}
