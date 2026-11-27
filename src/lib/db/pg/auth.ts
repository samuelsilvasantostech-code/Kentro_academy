import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getPool } from "./pool";
import { sendEmail } from "./email";
import * as core from "./auth-core";
import type {
  EmailLinkParams, ResetRequestResult, SessionUser, SignInResult, SignUpResult, UpdatePasswordResult,
} from "../auth/types";

/** Login próprio (DATA_BACKEND=postgres). Cookie httpOnly com token aleatório; no banco, só o HMAC dele. */
export const SESSION_COOKIE = "kentro_sessao";

function db() {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL não configurada");
  return pool;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64) : null;
}

async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: core.SESSION_DAYS * 24 * 60 * 60,
  });
}

async function currentToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value || null;
}

const lookup = cache(async (): Promise<SessionUser | null> => {
  const token = await currentToken();
  if (!token) return null;
  return core.sessionUser(db(), token);
});

/** A sessão é conferida no banco a cada pedido (desativar a conta derruba na hora). */
export const getSessionUser = lookup;
export const getSessionUserFast = lookup;

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  try {
    const r = await core.login(db(), email, password, await clientIp());
    if (!r.ok) return { error: r.reason };
    await setSessionCookie(r.token);
    return { error: null };
  } catch (err) {
    console.error(JSON.stringify({ level: "error", scope: "auth", action: "signIn", msg: err instanceof Error ? err.message : String(err) }));
    return { error: "other" };
  }
}

/** Cadastro pela tela de entrar está fechado: aluno novo entra por convite do admin (fase 7). */
export async function signUpWithPassword(): Promise<SignUpResult> {
  return { error: "other", signedIn: false };
}

export async function signOutCurrent(): Promise<void> {
  const token = await currentToken();
  if (token) await core.deleteSession(db(), token).catch(() => {});
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<ResetRequestResult> {
  try {
    const t = await core.createResetToken(db(), email);
    if (!t) return "sent"; // conta inexistente ou limite: mesma resposta
    const url = new URL(redirectTo);
    url.searchParams.set("token_hash", t.token);
    url.searchParams.set("type", "recovery");
    const sent = await sendEmail(
      t.email,
      "Kentro Academy: criar uma nova senha",
      `Recebemos um pedido para criar uma nova senha na Kentro Academy.\nO link vale por ${core.RESET_MINUTES} minutos e só funciona uma vez. Se não foi você, ignore este e-mail.`,
      { label: "Criar nova senha", url: url.toString() },
    );
    return sent === "sent" ? "sent" : "server_error";
  } catch (err) {
    console.error(JSON.stringify({ level: "error", scope: "auth", action: "requestReset", msg: err instanceof Error ? err.message : String(err) }));
    return "server_error";
  }
}

export async function setPassword(password: string): Promise<UpdatePasswordResult> {
  const user = await lookup();
  if (!user) return "error";
  try {
    return await core.changePassword(db(), user.id, password, await currentToken());
  } catch (err) {
    console.error(JSON.stringify({ level: "error", scope: "auth", action: "updatePassword", msg: err instanceof Error ? err.message : String(err) }));
    return "error";
  }
}

/** Link do e-mail: usa o token (uma vez só) e abre a sessão. */
export async function confirmEmailLink({ tokenHash, type }: EmailLinkParams): Promise<boolean> {
  const purpose = type === "recovery" ? "reset" : type === "invite" ? "invite" : null;
  if (!tokenHash || !purpose) return false;
  try {
    const userId = await core.consumeToken(db(), tokenHash, purpose);
    if (!userId) return false;
    await setSessionCookie(await core.createSession(db(), userId));
    return true;
  } catch (err) {
    console.error(JSON.stringify({ level: "error", scope: "auth", action: "confirmLink", msg: err instanceof Error ? err.message : String(err) }));
    return false;
  }
}

/** Para db/admin/session: usuário da sessão e se é admin (função is_admin no banco). */
export async function resolveAdmin(): Promise<{ user: SessionUser | null; admin: boolean }> {
  const user = await lookup();
  if (!user) return { user: null, admin: false };
  return { user, admin: await core.isAdmin(db(), user.id) };
}
