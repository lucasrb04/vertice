"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { addMember, changeMemberRole, leaveProject, removeMember } from "@/lib/projects/members";
import { runAction, type ActionResult } from "./result";

/** Painel, membros e demais subpáginas do projeto; `/painel` lista o papel em cada projeto. */
function revalidateMembers(projectId: string) {
  revalidatePath(`/projetos/${projectId}`, "layout");
  revalidatePath("/painel");
}

export async function addMemberAction(projectId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await addMember(user, projectId, input);
    revalidateMembers(projectId);
  });
}

export async function changeMemberRoleAction(
  projectId: string,
  memberUserId: string,
  role: "ADMIN" | "REVIEWER",
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await changeMemberRole(user, projectId, memberUserId, role);
    revalidateMembers(projectId);
  });
}

export async function removeMemberAction(projectId: string, memberUserId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await removeMember(user, projectId, memberUserId);
    revalidateMembers(projectId);
  });
}

export async function leaveProjectAction(projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await leaveProject(user, projectId);
    revalidateMembers(projectId);
    revalidatePath("/publicar");
  });
}
