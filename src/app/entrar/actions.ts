"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requestPasswordReset, signInWithPassword, signOutCurrent, signUpWithPassword, type AuthFailure } from "@/lib/db/auth";

export type AuthState = { error?: string; info?: string } | undefined;

const MSG: Partial<Record<AuthFailure, string>> = {
  invalid_credentials: "E-mail ou senha incorretos. Confira e tente de novo.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar. Procure a mensagem da Kentro Academy na sua caixa de entrada.",
  user_exists: "Já existe uma conta com este e-mail. Entre com sua senha ou use “Esqueci a senha”.",
  weak_password: "A senha precisa ter pelo menos 8 caracteres.",
};
const pt = (f: AuthFailure) => MSG[f] ?? "Não deu certo. Tente de novo em instantes.";

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Preencha e-mail e senha." };
  const { error } = await signInWithPassword(email, password);
  if (error) return { error: pt(error) };
  redirect("/");
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const full_name = String(form.get("full_name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!full_name || !email || !password) return { error: "Preencha nome, e-mail e senha." };
  if (full_name.length > 120 || company.length > 120) return { error: "Nome e empresa aceitam até 120 caracteres." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  const origin = siteUrl(await headers());
  const { error, signedIn } = await signUpWithPassword({ email, password, fullName: full_name, company, confirmUrl: `${origin}/auth/confirmar` });
  if (error) return { error: pt(error) };
  if (!signedIn) return { info: `Enviamos um link de confirmação para ${email}. Abra o e-mail e clique no link para entrar.` };
  redirect("/comecar");
}

/** Base dos links enviados por e-mail: NEXT_PUBLIC_SITE_URL (sem barra final) quando definida; senão, o que vier nos headers. */
function siteUrl(h: Headers) {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return h.get("origin") ?? (host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : "");
}

const RESET_INFO = "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também a caixa de spam.";

/** Pede o link de redefinição. A resposta é sempre a mesma, exista a conta ou não. */
export async function requestReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().slice(0, 254);
  if (!email || !email.includes("@")) return { error: "Digite o e-mail da sua conta." };
  const origin = siteUrl(await headers());
  const result = await requestPasswordReset(email, `${origin}/auth/confirmar?next=/redefinir-senha`);
  if (result === "rate_limited") return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  if (result === "server_error") return { error: "Não deu certo. Tente de novo em instantes." };
  return { info: RESET_INFO };
}

export async function signOut() {
  await signOutCurrent();
  redirect("/entrar");
}
