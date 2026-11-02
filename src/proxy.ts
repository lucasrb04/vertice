import { NextResponse, type NextRequest } from "next/server";
import { isSearchRateLimited } from "@/lib/security/search-limit";

export function proxy(request: NextRequest) {
  if (isSearchRateLimited(request.nextUrl, request.headers)) {
    return new NextResponse("Muitas buscas em pouco tempo. Tente de novo em um minuto.", {
      status: 429,
      headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.next();
}

export const config = { matcher: "/processos" };
