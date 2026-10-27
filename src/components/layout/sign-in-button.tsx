"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignInButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/painel",
        errorCallbackURL: "/entrar",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" size="lg" onClick={handleClick} disabled={pending}>
      Entrar com Google
    </Button>
  );
}
