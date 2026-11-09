import { Shell } from "@/components/layout/shell";
import { ProjectPanel } from "@/components/projects/project-panel";
import { PublishNotice } from "@/components/projects/publish-notice";
import { getEnv } from "@/env";
import { isHidden } from "@/lib/moderation/service";
import { pickPublishNotice } from "@/lib/projects/publish-notice";
import { getProjectPanel } from "@/lib/projects/queries";
import { processPublicUrl, shareMessage } from "@/lib/projects/share";
import { loadProjectReadPage } from "./access";

export const metadata = { title: "Painel do projeto — Vértice" };

export default async function ProjectPanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ publicado?: string | string[]; atualizado?: string | string[] }>;
}) {
  const { projectId } = await params;
  const access = await loadProjectReadPage(projectId);
  const { open, closed, inProgressCount, hiddenReason } = await getProjectPanel(access);
  const hidden = isHidden("PROJECT", access.project.status);
  const notice = pickPublishNotice(await searchParams, { open, closed }, access.canEdit);
  const publicUrl = notice ? processPublicUrl(getEnv().NEXT_PUBLIC_APP_URL, notice.opportunity.slug) : "";

  return (
    <Shell className="mt-8 space-y-6">
      {notice && (
        <PublishNotice
          kind={notice.kind}
          title={notice.opportunity.title}
          publicPath={`/processo/${notice.opportunity.slug}`}
          publicUrl={publicUrl}
          shareText={shareMessage({
            title: notice.opportunity.title,
            projectName: access.project.name,
            deadlineAt: notice.opportunity.deadlineAt,
            url: publicUrl,
          })}
        />
      )}
      <ProjectPanel
        project={access.project}
        role={access.membership?.role ?? null}
        canEdit={access.canEdit}
        canManageMembers={access.canManageMembers}
        open={open}
        closed={closed}
        inProgressCount={inProgressCount}
        hidden={hidden}
        hiddenReason={hiddenReason}
      />
    </Shell>
  );
}
