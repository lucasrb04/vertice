import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { getEnv, type Env } from "@/env";

/**
 * Envia um e-mail transacional pelo Resend. Sem `RESEND_API_KEY` não há envio nem chamada de rede.
 * Nunca lança e devolve se o provedor aceitou. O log traz só o tipo do erro: o erro do provedor
 * pode ecoar destinatário, nome e mensagem.
 */
export async function sendEmail(
  input: { to: string; subject: string; react: ReactElement },
  env: Env = getEnv(),
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.info("[email] RESEND_API_KEY ou EMAIL_FROM ausente: envio ignorado");
    return false;
  }
  try {
    const [html, text] = await Promise.all([render(input.react), render(input.react, { plainText: true })]);
    const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html,
      text,
    });
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
