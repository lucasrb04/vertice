"use client";

import { archiveProjectAction } from "@/actions/project.actions";
import { ConfirmActionButton } from "./confirm-action-button";

const ARCHIVE_CONFIRMATION = "Arquivar encerra todos os processos do projeto e não pode ser desfeito nesta versão.";

/** Só para o OWNER em projeto ACTIVE (spec §6.6): arquivar é definitivo nesta fase. */
export function ArchiveProjectButton({ projectId }: { projectId: string }) {
  return (
    <ConfirmActionButton
      label="Arquivar projeto"
      title="Arquivar este projeto?"
      description={ARCHIVE_CONFIRMATION}
      confirmLabel="Arquivar"
      action={() => archiveProjectAction(projectId)}
      variant="destructive"
      size="lg"
    />
  );
}
