import { and, eq, inArray } from "drizzle-orm";
import { createElement } from "react";
import { db } from "@/db";
import { applications, opportunities, projects, users } from "@/db/schema";
import { getEnv } from "@/env";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/labels";
import type { ModerationTargetType } from "@/lib/validation/moderation";
import { sendEmail, sendEmailBatch } from "./send";
import { ApplicationReceivedEmail } from "./templates/application-received";
import { ReviewAlertEmail } from "./templates/review-alert";
import { StatusChangedEmail } from "./templates/status-changed";

const recipients = () =>
  db
    .select({
      applicationId: applications.id,
      name: users.name,
      email: users.email,
      isBanned: users.isBanned,
      opportunityTitle: opportunities.title,
      projectName: projects.name,
    })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(projects, eq(projects.id, opportunities.projectId));

// O log não leva nome, e-mail, mensagem nem o objeto do erro (o do Drizzle traz os parâmetros).
const logFailure = (what: string) => console.error(`[email] falha ao preparar ${what}`);

const myApplicationsUrl = () => new URL("/minhas-candidaturas", getEnv().NEXT_PUBLIC_APP_URL).toString();

/** Confirmação da candidatura. Roda depois do commit e nunca lança. */
export async function notifyApplicationReceived(applicationId: string): Promise<void> {
  try {
    const [row] = await recipients().where(eq(applications.id, applicationId));
    if (!row || row.isBanned) return;
    await sendEmail({
      to: row.email,
      subject: `Candidatura recebida: ${row.opportunityTitle}`,
      react: createElement(ApplicationReceivedEmail, {
        studentName: row.name,
        opportunityTitle: row.opportunityTitle,
        projectName: row.projectName,
        url: myApplicationsUrl(),
      }),
    });
  } catch {
    logFailure("a confirmação de candidatura");
  }
}

/** Aviso de mudança de etapa, um e-mail por candidatura numa só chamada ao provedor. Nunca lança. */
export async function notifyStatusChanged(
  moved: { applicationId: string; toStatus: ApplicationStatus; message: string | null }[],
): Promise<void> {
  if (moved.length === 0) return;
  try {
    const rows = await recipients().where(
      inArray(
        applications.id,
        moved.map((m) => m.applicationId),
      ),
    );
    const byId = new Map(rows.map((r) => [r.applicationId, r]));
    const url = myApplicationsUrl();
    const emails = moved.flatMap((item) => {
      const row = byId.get(item.applicationId);
      if (!row || row.isBanned) return [];
      const statusLabel = APPLICATION_STATUS_LABELS[item.toStatus];
      return {
        to: row.email,
        subject: `Sua candidatura mudou de etapa: ${statusLabel}`,
        react: createElement(StatusChangedEmail, {
          studentName: row.name,
          opportunityTitle: row.opportunityTitle,
          projectName: row.projectName,
          statusLabel,
          message: item.message,
          url,
        }),
      };
    });
    await sendEmailBatch(emails);
  } catch {
    logFailure("os avisos de mudança de etapa");
  }
}

const TARGET_LABELS: Record<ModerationTargetType, string> = { PROJECT: "Projeto", OPPORTUNITY: "Processo" };

async function targetName(target: { institutionId: string; targetType: ModerationTargetType; targetId: string }) {
  const [row] =
    target.targetType === "PROJECT"
      ? await db
          .select({ name: projects.name })
          .from(projects)
          .where(and(eq(projects.id, target.targetId), eq(projects.institutionId, target.institutionId)))
      : await db
          .select({ name: opportunities.title })
          .from(opportunities)
          .where(and(eq(opportunities.id, target.targetId), eq(opportunities.institutionId, target.institutionId)));
  return row?.name ?? null;
}

/** Alvo ocultado por denúncias: um e-mail a cada `SYSTEM_ADMIN` ativo da instituição. Nunca lança. */
export async function notifyReviewAlert(target: {
  institutionId: string;
  targetType: ModerationTargetType;
  targetId: string;
}): Promise<void> {
  try {
    const name = await targetName(target);
    if (!name) return;
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.institutionId, target.institutionId),
          eq(users.systemRole, "SYSTEM_ADMIN"),
          eq(users.isBanned, false),
        ),
      );
    const targetLabel = TARGET_LABELS[target.targetType];
    const url = new URL("/admin", getEnv().NEXT_PUBLIC_APP_URL).toString();
    await sendEmailBatch(
      admins.map((admin) => ({
        to: admin.email,
        subject: `${targetLabel} em revisão por denúncias: ${name}`,
        react: createElement(ReviewAlertEmail, { targetLabel, targetName: name, url }),
      })),
    );
  } catch {
    logFailure("o aviso de revisão automática");
  }
}
