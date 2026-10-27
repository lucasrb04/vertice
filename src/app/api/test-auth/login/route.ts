import { z } from "zod";
import { AuthPolicyError } from "@/lib/auth/errors";
import { buildSessionCookie, createTestSession, isTestAuthEnabled } from "@/lib/auth/test-auth";

const bodySchema = z.strictObject({
  email: z.string().trim().min(3).max(255),
  name: z.string().trim().min(1).max(120),
});

/** Login de teste (D33). Inexistente (404) fora de ENABLE_TEST_AUTH. */
export async function POST(request: Request): Promise<Response> {
  if (!isTestAuthEnabled()) return new Response(null, { status: 404 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY" }, { status: 400 });

  try {
    const { userId, sessionToken } = await createTestSession(parsed.data);
    const headers = new Headers({ "set-cookie": await buildSessionCookie(sessionToken) });
    return Response.json({ userId }, { status: 200, headers });
  } catch (err) {
    if (err instanceof AuthPolicyError) return Response.json({ error: err.code }, { status: 403 });
    throw err;
  }
}
