import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationBoard } from "@/components/applications/board";
import { type Board, getBoard } from "@/lib/applications/board";
import { NotFoundError } from "@/lib/auth/errors";
import { requireAuthPage } from "@/lib/auth/guards";
import { getRequestIp } from "@/lib/security/audit";

export const metadata = { title: "Candidatos — Vértice" };

export default async function CandidatosPage({
  params,
}: {
  params: Promise<{ projectId: string; opportunityId: string }>;
}) {
  const { projectId, opportunityId } = await params;
  const user = await requireAuthPage();
  const ipAddress = getRequestIp(await headers());
  // `getBoard` faz a autorização completa: repetir o guard aqui auditaria o acesso de admin duas vezes.
  let board: Board | null = null;
  try {
    board = await getBoard(user, projectId, opportunityId, { ipAddress });
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
  }
  if (!board) notFound();

  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 pt-8 sm:px-6">
      <Link
        href={`/projetos/${board.project.id}`}
        className="text-sm font-semibold text-ink underline underline-offset-4 hover:decoration-2"
      >
        ← {board.project.name}
      </Link>
      <h1 className="mt-2 text-[1.75rem] leading-tight font-extrabold text-ink">Candidatos</h1>
      <p className="mt-1 [overflow-wrap:anywhere] text-stone-600">{board.opportunity.title}</p>
      {board.readOnlyReason && (
        <p role="status" className="mt-4 rounded-2xl bg-surface shadow-card px-3 py-2 text-sm text-stone-700">
          {board.readOnlyReason}
        </p>
      )}
      <ApplicationBoard board={board} />
    </section>
  );
}
