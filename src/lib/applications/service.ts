import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "@/db";
import {
  applicationEvents,
  applications,
  courses,
  opportunities,
  projectMembers,
  projects,
  studentProfiles,
} from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import type { AuthUser } from "@/lib/auth/guards";
import { isUniqueViolation } from "@/lib/db-errors";
import { DomainError, fromZodError, RateLimitError } from "@/lib/domain-errors";
import { isOpportunityOpen, opensInFuture } from "@/lib/opportunities/status";
import { publicOpportunitySql } from "@/lib/public/queries";
import { applicationLimiter } from "@/lib/security/rate-limit";
import { lockProjectSearchDocuments } from "@/lib/search/index-documents";
import { applySchema, type ApplyInput } from "@/lib/validation/application";

export const APPLICATIONS_CLOSED = "As candidaturas deste processo foram encerradas.";
export const NO_INTERNAL_SELECTION = "Este processo não recebe candidaturas pelo Vértice.";
export const NOT_OPEN_YET = "As candidaturas deste processo ainda não abriram.";
export const ALREADY_APPLIED = "Você já se candidatou a este processo.";
export const PROJECT_MEMBER = "Você faz parte da equipe deste projeto e não pode se candidatar.";
export const APPLICATION_RATE_LIMITED = "Muitas candidaturas em pouco tempo. Tente de novo mais tarde.";

const ANSWER_REQUIRED = "Responda à pergunta.";

const fieldError = (path: string, message: string) =>
  fromZodError(new ZodError([{ code: "custom", path: [path], message }]));

/** Coluna do perfil que guarda o link, pelo domínio; o que não for rede conhecida vira portfólio. */
function profileLinkColumn(link: string): "githubUrl" | "linkedinUrl" | "lattesUrl" | "portfolioUrl" {
  const host = new URL(link).hostname.toLowerCase();
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is("github.com")) return "githubUrl";
  if (is("linkedin.com")) return "linkedinUrl";
  if (is("lattes.cnpq.br")) return "lattesUrl";
  return "portfolioUrl";
}

/**
 * Candidatura do aluno com atualização do perfil curto. O processo é travado em `FOR SHARE`, depois
 * da trava do projeto: desligar a seleção (`lockOpenOpportunity`, `FOR UPDATE`) espera esta transação
 * e enxerga a candidatura, e uma candidatura que chega depois enxerga o processo já desligado.
 */
export async function applyToOpportunity(
  user: AuthUser,
  input: ApplyInput,
  opts: { now?: Date } = {},
): Promise<{ applicationId: string; opportunitySlug: string }> {
  const now = opts.now ?? new Date();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) throw fromZodError(parsed.error);
  const data = parsed.data;

  const [target] = await db
    .select({ id: opportunities.id, projectId: opportunities.projectId, customQuestion: opportunities.customQuestion })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(
      and(
        eq(opportunities.institutionId, user.institutionId),
        eq(opportunities.slug, data.opportunitySlug),
        publicOpportunitySql(),
      ),
    );
  if (!target) throw new NotFoundError();
  if (target.customQuestion && !data.answerText) throw fieldError("answerText", ANSWER_REQUIRED);

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, data.courseId), eq(courses.institutionId, user.institutionId)));
  if (!course) throw fieldError("courseId", "Escolha o seu curso.");

  // Só depois de validar: erro de preenchimento não gasta o limite.
  if (!applicationLimiter.consume(user.id)) throw new RateLimitError(APPLICATION_RATE_LIMITED);

  try {
    return await db.transaction(async (tx) => {
      await lockProjectSearchDocuments(tx, target.projectId);
      const [opp] = await tx
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, target.id))
        .for("share");
      const [project] = await tx.select({ status: projects.status }).from(projects).where(eq(projects.id, target.projectId));
      if (!opp || !project || opp.status === "UNDER_REVIEW") throw new NotFoundError();

      if (!isOpportunityOpen(opp, project.status, now)) throw new DomainError("OPPORTUNITY_CLOSED", APPLICATIONS_CLOSED);
      if (!opp.internalSelectionEnabled) throw new DomainError("NO_INTERNAL_SELECTION", NO_INTERNAL_SELECTION);
      if (opensInFuture(opp.applicationsOpenOn, now)) throw new DomainError("NOT_OPEN_YET", NOT_OPEN_YET);
      // A pergunta pode ter sido criada depois da leitura lá de cima; vale a linha travada.
      if (opp.customQuestion && !data.answerText) throw fieldError("answerText", ANSWER_REQUIRED);

      const [member] = await tx
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, opp.projectId), eq(projectMembers.userId, user.id)));
      if (member) throw new DomainError("PROJECT_MEMBER", PROJECT_MEMBER);

      const [existing] = await tx
        .select({ id: applications.id })
        .from(applications)
        .where(and(eq(applications.opportunityId, opp.id), eq(applications.userId, user.id)));
      if (existing) throw new DomainError("ALREADY_APPLIED", ALREADY_APPLIED);

      const [app] = await tx
        .insert(applications)
        .values({
          opportunityId: opp.id,
          userId: user.id,
          answerText: opp.customQuestion ? data.answerText : null,
          externalProfileLink: data.profileLink,
        })
        .returning({ id: applications.id });
      await tx
        .insert(applicationEvents)
        .values({ applicationId: app!.id, fromStatus: null, toStatus: "APPLIED", actorUserId: user.id });

      const profile = { courseId: data.courseId, currentSemester: data.currentSemester, updatedAt: now };
      const link = data.profileLink ? { [profileLinkColumn(data.profileLink)]: data.profileLink } : {};
      await tx
        .insert(studentProfiles)
        .values({ userId: user.id, ...profile, ...link })
        .onConflictDoUpdate({ target: studentProfiles.userId, set: { ...profile, ...link } });

      return { applicationId: app!.id, opportunitySlug: opp.slug };
    });
  } catch (err) {
    // Duas chamadas concorrentes passam pela checagem acima; o índice único decide.
    if (isUniqueViolation(err)) throw new DomainError("ALREADY_APPLIED", ALREADY_APPLIED);
    throw err;
  }
}
