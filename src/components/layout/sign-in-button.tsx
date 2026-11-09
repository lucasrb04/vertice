"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { signInErrorPath } from "@/lib/auth/next-path";

/** `next` já passou por `safeNextPath`. */
export function SignInButton({ next = "/painel" }: { next?: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: next,
        errorCallbackURL: signInErrorPath(next),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" size="lg" onClick={handleClick} disabled={pending} className="w-full">
      Entrar com Google
    </Button>
  );
}
