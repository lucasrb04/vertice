import { requireAuthPage } from "@/lib/auth/guards";

export default async function PainelPage() {
  const user = await requireAuthPage();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-stone-900">
        Olá, {user.name}
      </h1>
      <p className="mt-3 max-w-prose text-stone-600">
        Suas candidaturas e seu perfil aparecerão aqui.
      </p>
    </section>
  );
}
