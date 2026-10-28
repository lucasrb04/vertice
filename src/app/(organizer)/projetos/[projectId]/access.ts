import { notFound } from "next/navigation";
import type { ProjectRole } from "@/db/schema";
import { requireProjectRolePage, type ProjectAccess } from "@/lib/auth/guards";
import { ALL_ROLES, EDITOR_ROLES, effectiveMembership, projectCapabilities } from "@/lib/projects/permissions";

type Membership = { role: ProjectRole };

/**
 * Páginas de leitura (painel, membros): qualquer papel, inclusive projeto inativo. Devolve a
 * membership real (SYSTEM_ADMIN sem membership → `null`, só leitura) e o que a tela pode oferecer.
 */
export async function loadProjectReadPage(projectId: string) {
  const access = await requireProjectRolePage(projectId, ALL_ROLES, { allowInactive: true });
  const membership = await effectiveMembership(access);
  return { ...access, membership, ...projectCapabilities(access.project.status, membership) };
}

/**
 * Páginas de edição: membership real com um dos `roles` e projeto ACTIVE, senão 404. O guard deixa
 * SYSTEM_ADMIN passar em qualquer status, então a membership e o status são conferidos aqui.
 */
export async function loadProjectEditPage(
  projectId: string,
  roles: readonly ProjectRole[] = EDITOR_ROLES,
): Promise<ProjectAccess & { membership: Membership }> {
  const access = await requireProjectRolePage(projectId, roles);
  const membership = await effectiveMembership(access);
  if (!membership || !roles.includes(membership.role) || access.project.status !== "ACTIVE") notFound();
  return { ...access, membership };
}
