import { requireSystemAdminPage } from "@/lib/auth/guards";

export default async function AdminPage() {
  await requireSystemAdminPage("/admin");
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-stone-900">
        Portal do administrador
      </h1>
      <p className="mt-3 max-w-prose text-stone-600">Ferramentas de administração do Vértice.</p>
    </section>
  );
}
