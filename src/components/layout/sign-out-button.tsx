import { Button } from "@/components/ui/button";

/** Formulário nativo: o POST em /api/sign-out encerra a sessão e redireciona para a home. */
export function SignOutButton() {
  return (
    <form action="/api/sign-out" method="post">
      <Button type="submit" variant="outline" size="sm">
        Sair
      </Button>
    </form>
  );
}
