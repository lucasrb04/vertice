import { pathToFileURL } from "node:url";
import { closeDb, db } from "@/db";
import { institutions } from "@/db/schema";
import { rebuildSearchDocuments, rebuildSearchVocabulary } from "@/lib/search/index-documents";

export async function rebuildSearch(institutionId: string): Promise<void> {
  await rebuildSearchDocuments(institutionId);
  await rebuildSearchVocabulary(institutionId);
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  db.select({ id: institutions.id })
    .from(institutions)
    .then(async (rows) => {
      for (const { id } of rows) await rebuildSearch(id);
      console.log("Índice de busca reconstruído.");
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
