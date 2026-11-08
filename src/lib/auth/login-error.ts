import { type AuthErrorCode, isAuthErrorCode } from "./errors";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  DOMAIN_NOT_ALLOWED: "Use sua conta @unifei.edu.br.",
  EMAIL_NOT_VERIFIED: "Seu e-mail Google não está verificado.",
  ACCOUNT_SUSPENDED: "Conta suspensa. Fale com a administração do Vértice.",
};

/**
 * Better-Auth 1.7.14 redireciona com `unable_to_get_user_info` quando o `hd` do Google não
 * confere (google.mjs: getUserInfo devolve null -> oauth2/callback.mjs). Na prática, hd divergente;
 * o mesmo código pode vir de outras falhas de userinfo, tratadas como domínio recusado.
 */
const BETTER_AUTH_HD_MISMATCH_CODE = "unable_to_get_user_info";

/** O parâmetro vem da URL: só é mostrado e registrado se tiver cara de código. */
const CODE_FORMAT = /^[A-Za-z0-9_]{1,64}$/;

export type LoginError = {
  message: string;
  /** Código que o Vértice não conhece: a página registra no log para diagnóstico. */
  unmappedCode: string | null;
};

/** Mensagem de `/entrar?error=<código>`. Código desconhecido aparece na tela e vai para o log. */
export function loginError(raw: string | undefined): LoginError | null {
  if (!raw) return null;
  if (isAuthErrorCode(raw)) return { message: AUTH_ERROR_MESSAGES[raw], unmappedCode: null };
  if (raw === BETTER_AUTH_HD_MISMATCH_CODE)
    return { message: AUTH_ERROR_MESSAGES.DOMAIN_NOT_ALLOWED, unmappedCode: null };
  if (!CODE_FORMAT.test(raw)) {
    return { message: "Não foi possível entrar. Tente novamente.", unmappedCode: "codigo_invalido" };
  }
  return { message: `Não foi possível entrar (código ${raw}). Tente novamente.`, unmappedCode: raw };
}
