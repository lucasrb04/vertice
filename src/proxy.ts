import { type NextRequest, NextResponse } from "next/server";
import { isSearchRateLimited } from "@/lib/security/search-limit";

export const RATE_LIMITED_HTML = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Muitas buscas</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #1c1917">
<p>Muitas buscas em pouco tempo. Tente de novo em um minuto.</p>
<p><a href="/processos">Ver todos os processos</a></p>
</body>
</html>
`;

export function proxy(request: NextRequest) {
  if (isSearchRateLimited(request.nextUrl, request.headers)) {
    return new NextResponse(RATE_LIMITED_HTML, {
      status: 429,
      headers: { "Retry-After": "60", "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.next();
}

export const config = { matcher: "/processos" };
