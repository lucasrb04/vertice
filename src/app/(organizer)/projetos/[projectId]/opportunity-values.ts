import { notFound } from "next/navigation";
import type { AuthUser } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/auth/errors";
import { getOpportunityFormValues } from "@/lib/opportunities/service";

/** `getOpportunityFormValues` para páginas: processo inexistente, de outro projeto ou uuid inválido → 404. */
export async function loadOpportunityValuesPage(
  user: AuthUser,
  projectId: string,
  opportunityId: string,
  mode: "edit" | "duplicate",
) {
  let result: Awaited<ReturnType<typeof getOpportunityFormValues>> | null = null;
  try {
    result = await getOpportunityFormValues(user, projectId, opportunityId, mode);
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
  }
  if (!result) notFound();
  return result;
}
