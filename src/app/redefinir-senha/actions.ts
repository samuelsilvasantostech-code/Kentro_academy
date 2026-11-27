"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ResetState = { error?: string; ok?: boolean } | undefined;

export async function updatePassword(_: ResetState, form: FormData): Promise<ResetState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password.length > 72) return { error: "A senha aceita até 72 caracteres." };
  if (password !== confirm) return { error: "As senhas estão diferentes. Digite a mesma senha nos dois campos." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?erro=link");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Escolha uma senha diferente da atual." };
    if (error.code === "weak_password") return { error: "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números." };
    console.error(JSON.stringify({ level: "error", scope: "auth", action: "updatePassword", code: error.code ?? null }));
    return { error: "Não foi possível salvar a nova senha. Tente de novo em instantes." };
  }
  return { ok: true };
}
