"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string } | undefined;

const MSG: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos. Confira e tente de novo.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar. Procure a mensagem da Kentro Academy na sua caixa de entrada.",
  "User already registered": "Já existe uma conta com este e-mail. Entre com sua senha ou use “Esqueci a senha”.",
};
const pt = (m: string) => MSG[m] ?? (m.includes("Password") ? "A senha precisa ter pelo menos 8 caracteres." : "Não deu certo. Tente de novo em instantes.");

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Preencha e-mail e senha." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: pt(error.message) };
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
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name, company }, emailRedirectTo: `${origin}/auth/confirmar` },
  });
  if (error) return { error: pt(error.message) };
  if (!data.session) return { info: `Enviamos um link de confirmação para ${email}. Abra o e-mail e clique no link para entrar.` };
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
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirmar?next=/redefinir-senha`,
  });
  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
    }
    console.error(JSON.stringify({ level: "error", scope: "auth", action: "requestReset", code: error.code ?? null, status: error.status ?? null }));
    if ((error.status ?? 500) >= 500) return { error: "Não deu certo. Tente de novo em instantes." };
  }
  return { info: RESET_INFO };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
