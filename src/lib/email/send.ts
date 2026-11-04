import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { type Env, getEnv } from "@/env";

type EmailInput = { to: string; subject: string; react: ReactElement };

const RATE_LIMIT_RETRY_MS = 1000;

/** Sem chave não há envio nem chamada de rede. */
function configured(env: Env): { apiKey: string; from: string } | null {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM };
  console.info("[email] RESEND_API_KEY ou EMAIL_FROM ausente: envio ignorado");
  return null;
}

async function renderEmail({ react }: EmailInput): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);
  return { html, text };
}

/** Limite do provedor: recusa antes de enviar, então repetir uma vez não duplica nada. */
async function retryingRateLimit<R extends { error: { name: string } | null }>(call: () => Promise<R>): Promise<R> {
  const first = await call();
  if (first.error?.name !== "rate_limit_exceeded") return first;
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_MS));
  return call();
}

/**
 * Envia um e-mail transacional pelo Resend. Nunca lança e devolve se o provedor aceitou. O log traz
 * só o tipo do erro: o erro do provedor pode ecoar destinatário, nome e mensagem.
 */
export async function sendEmail(input: EmailInput, env: Env = getEnv()): Promise<boolean> {
  const config = configured(env);
  if (!config) return false;
  try {
    const body = { from: config.from, to: input.to, subject: input.subject, ...(await renderEmail(input)) };
    const client = new Resend(config.apiKey);
    const { error } = await retryingRateLimit(() => client.emails.send(body));
    if (error) {
      console.error("[email] provedor recusou o envio", error.name);
      return false;
    }
    return true;
  } catch {
    console.error("[email] falha ao enviar");
    return false;
  }
}

/**
 * Vários e-mails numa só requisição, para não esbarrar no limite por segundo do provedor. A API aceita
 * até 100 por chamada, acima de `MOVE_ITEMS_MAX`. Nunca lança e devolve quantos foram aceitos; em modo
 * `permissive`, um endereço recusado não derruba os demais. Mesma regra de log de `sendEmail`.
 */
export async function sendEmailBatch(inputs: EmailInput[], env: Env = getEnv()): Promise<number> {
  if (inputs.length === 0) return 0;
  const config = configured(env);
  if (!config) return 0;
  try {
    const rendered = await Promise.all(
      inputs.map(async (input) => {
        try {
          return { from: config.from, to: input.to, subject: input.subject, ...(await renderEmail(input)) };
        } catch {
          console.error("[email] falha ao montar um e-mail do lote");
          return null;
        }
      }),
    );
    const emails = rendered.filter((email) => email !== null);
    if (emails.length === 0) return 0;

    const client = new Resend(config.apiKey);
    const { data, error } = await retryingRateLimit(() => client.batch.send(emails, { batchValidation: "permissive" }));
    if (error) {
      console.error("[email] provedor recusou o lote", error.name);
      return 0;
    }
    const refused = data.errors?.length ?? 0;
    if (refused > 0) console.error("[email] provedor recusou parte do lote", refused);
    return data.data.length;
  } catch {
    console.error("[email] falha ao enviar o lote");
    return 0;
  }
}
