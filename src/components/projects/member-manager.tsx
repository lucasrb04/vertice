"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addMemberAction,
  changeMemberRoleAction,
  leaveProjectAction,
  removeMemberAction,
} from "@/actions/member.actions";
import type { ActionResult } from "@/actions/result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/projects/labels";
import { ConfirmActionButton } from "./confirm-action-button";
import { Field, FormMessage } from "./field";
import { errorsFor, type FieldErrors } from "./form-errors";

type Role = keyof typeof ROLE_LABELS;
type AssignableRole = Exclude<Role, "OWNER">;
const ASSIGNABLE: AssignableRole[] = ["ADMIN", "REVIEWER"];

export type MemberItem = { userId: string; name: string; email: string; role: Role };

const failed = (): ActionResult => ({
  ok: false,
  error: "RULE",
  message: "Não foi possível concluir agora. Tente de novo.",
});

function AddMemberForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("REVIEWER");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    const res = await addMemberAction(projectId, { email, role }).catch(failed);
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      return;
    }
    setErrors({});
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl bg-surface p-5 shadow-card sm:p-7">
      <h2 className="text-[1.2rem] font-bold text-ink">Adicionar membro</h2>
      <div className="grid gap-5 sm:grid-cols-6">
        <Field
          label="E-mail da pessoa"
          hint="A pessoa precisa ter entrado no Vértice ao menos uma vez com a conta @unifei.edu.br."
          errors={errorsFor(errors, "email")}
          className="sm:col-span-4"
        >
          {(p) => (
            <Input
              {...p}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="nome@unifei.edu.br"
            />
          )}
        </Field>
        <Field label="Papel" errors={errorsFor(errors, "role")} className="sm:col-span-2">
          {(p) => (
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger {...p} className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <FormMessage message={message} />
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending} className="px-4">
          {pending ? "Adicionando…" : "Adicionar"}
        </Button>
      </div>
    </form>
  );
}

function RoleSelect({ projectId, member }: { projectId: string; member: MemberItem }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function change(next: AssignableRole) {
    if (next === member.role) return;
    setPending(true);
    setMessage(null);
    const res = await changeMemberRoleAction(projectId, member.userId, next).catch(failed);
    setPending(false);
    if (!res.ok) setMessage(res.message);
    else router.refresh();
  }

  return (
    <div className="space-y-1">
      <Select value={member.role} onValueChange={(v) => change(v as AssignableRole)} disabled={pending}>
        <SelectTrigger aria-label={`Papel de ${member.name}`} size="sm" className="w-40 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSIGNABLE.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {message && (
        <p role="alert" className="text-sm text-danger-ink">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Membros e papéis (spec §6.6). Todos veem a lista; o OWNER (projeto ACTIVE) adiciona, muda papel e
 * remove; os demais membros podem sair do projeto.
 */
export function MemberManager({
  projectId,
  members,
  canManage,
  canLeave,
}: {
  projectId: string;
  members: MemberItem[];
  canManage: boolean;
  canLeave: boolean;
}) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="membros-do-projeto">
        <h2 id="membros-do-projeto" className="text-[1.2rem] font-bold text-ink">
          Membros do projeto <span className="tabular-nums text-sm font-normal text-stone-500">{members.length}</span>
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl bg-surface shadow-card">
          {members.map((m) => {
            const editable = canManage && m.role !== "OWNER";
            return (
              <li
                key={m.userId}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{m.name}</p>
                  <p className="truncate tabular-nums text-xs text-stone-600">{m.email}</p>
                </div>
                {editable ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <RoleSelect projectId={projectId} member={m} />
                    <ConfirmActionButton
                      label="Remover"
                      title={`Remover ${m.name}?`}
                      description="A pessoa perde o acesso ao painel do projeto. Ela pode ser adicionada de novo depois."
                      confirmLabel="Remover"
                      action={() => removeMemberAction(projectId, m.userId)}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-stone-700">{ROLE_LABELS[m.role]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && <AddMemberForm projectId={projectId} />}

      {canLeave && (
        <div className="flex justify-end">
          <ConfirmActionButton
            label="Sair do projeto"
            title="Sair deste projeto?"
            description="Você perde o acesso ao painel. Para voltar, o dono do projeto precisa adicionar você de novo."
            confirmLabel="Sair"
            action={() => leaveProjectAction(projectId)}
            redirectTo="/painel"
            size="lg"
          />
        </div>
      )}
    </div>
  );
}
