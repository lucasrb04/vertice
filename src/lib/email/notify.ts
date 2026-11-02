import { createElement } from "react";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications, opportunities, projects, users } from "@/db/schema";
import { getEnv } from "@/env";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/labels";
import { sendEmail, sendEmailBatch } from "./send";
import { ApplicationReceivedEmail } from "./templates/application-received";
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
