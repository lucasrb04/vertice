"use client";

import { archiveProjectAction } from "@/actions/project.actions";
import { archiveConfirmation } from "@/lib/projects/labels";
import { ConfirmActionButton } from "./confirm-action-button";

/** Só para o OWNER em projeto ACTIVE (spec §6.6): arquivar é definitivo nesta fase. */
export function ArchiveProjectButton({ projectId, inProgressCount }: { projectId: string; inProgressCount: number }) {
  return (
    <ConfirmActionButton
      label="Arquivar projeto"
      title="Arquivar este projeto?"
      description={archiveConfirmation(inProgressCount)}
      confirmLabel="Arquivar"
      action={() => archiveProjectAction(projectId)}
      variant="destructive"
      size="lg"
    />
  );
}
