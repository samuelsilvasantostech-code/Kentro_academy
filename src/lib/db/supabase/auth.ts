import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "./client";
import type {
  AuthFailure, EmailLinkParams, ResetRequestResult, SessionUser, SignInResult, SignUpResult, UpdatePasswordResult,
} from "../auth/types";

/** Traduz a mensagem do provedor (em inglês) para um motivo estável. */
function failure(message: string): AuthFailure {
  if (message === "Invalid login credentials") return "invalid_credentials";
  if (message === "Email not confirmed") return "email_not_confirmed";
  if (message === "User already registered") return "user_exists";
  if (message.includes("Password")) return "weak_password";
  return "other";
}

/** Usuário da sessão, conferido no servidor de Auth (detecta sessão revogada). Para quem grava. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? "" } : null;
}

/** Usuário da sessão pela assinatura do token, sem ida ao Auth (chave assimétrica). Para leitura. */
export async function getSessionUserFast(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
}

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error ? failure(error.message) : null };
}

export async function signUpWithPassword(
  input: { email: string; password: string; fullName: string; company: string; confirmUrl: string },
): Promise<SignUpResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName, company: input.company }, emailRedirectTo: input.confirmUrl },
  });
  if (error) return { error: failure(error.message), signedIn: false };
  return { error: null, signedIn: !!data.session };
}

export async function signOutCurrent(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<ResetRequestResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (!error) return "sent";
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") return "rate_limited";
  console.error(JSON.stringify({ level: "error", scope: "auth", action: "requestReset", code: error.code ?? null, status: error.status ?? null }));
  return (error.status ?? 500) >= 500 ? "server_error" : "sent";
}

export async function setPassword(password: string): Promise<UpdatePasswordResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return "ok";
  if (error.code === "same_password") return "same_password";
  if (error.code === "weak_password") return "weak_password";
  console.error(JSON.stringify({ level: "error", scope: "auth", action: "updatePassword", code: error.code ?? null }));
  return "error";
}

/** Link do e-mail (confirmação, recuperação): troca o token ou o código por sessão. */
export async function confirmEmailLink({ tokenHash, type, code }: EmailLinkParams): Promise<boolean> {
  const supabase = await createClient();
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    return !error;
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }
  return false;
}
