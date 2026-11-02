import { NextResponse } from "next/server";
import { getPublicOpportunity } from "@/lib/public/queries";
import { getVisitorHashSecret, recordExternalClick, visitorHash } from "@/lib/public/telemetry";
import { getRequestIp } from "@/lib/security/audit";
import { getDefaultInstitution } from "@/lib/tenant";

const notFound = () => new NextResponse("Não encontrado", { status: 404 });

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (slug.length > 140 || slug.includes("\0")) return notFound();

  const institution = await getDefaultInstitution();
  const result = await getPublicOpportunity(institution.id, slug);
  const stored = result?.opportunity.externalUrl;
  if (!result || !stored) return notFound();

  let target: URL;
  try {
    target = new URL(stored);
  } catch {
    return notFound();
  }
  if (target.protocol !== "https:") return notFound();

  try {
    const hash = visitorHash(
      getRequestIp(request.headers),
      request.headers.get("user-agent"),
      getVisitorHashSecret(),
    );
    await recordExternalClick(result.opportunity.id, hash);
  } catch (error) {
    console.error("[telemetria] falha ao registrar clique no edital", error);
  }

  const res = NextResponse.redirect(target.toString(), 302);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
