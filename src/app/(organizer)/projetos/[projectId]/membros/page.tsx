import Link from "next/link";
import { MemberManager } from "@/components/projects/member-manager";
import { listMembers } from "@/lib/projects/queries";
import { loadProjectReadPage } from "../access";

export const metadata = { title: "Membros do projeto — Vértice" };

export default async function MembersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await loadProjectReadPage(projectId);
  const members = await listMembers(access);

  return (
    <section className="mx-auto w-full max-w-[880px] px-4 pt-8 sm:px-6">
      <Link
        href={`/projetos/${access.project.id}`}
        className="text-sm font-semibold text-ink underline underline-offset-4 hover:decoration-2"
      >
        ← {access.project.name}
      </Link>
      <h1 className="mt-2 text-[1.75rem] leading-tight font-extrabold text-ink">Membros</h1>
      <p className="mt-3 text-stone-600">
        O dono gerencia os membros. Administradores editam o projeto e os processos; revisores só acompanham.
      </p>
      <div className="mt-8">
        <MemberManager
          projectId={access.project.id}
          members={members}
          canManage={access.canManageMembers}
          canLeave={access.canLeave}
        />
      </div>
    </section>
  );
}
