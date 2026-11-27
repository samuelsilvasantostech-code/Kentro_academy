"use server";

import { redirect } from "next/navigation";
import { getSessionUser, setPassword } from "@/lib/db/auth";

export type ResetState = { error?: string; ok?: boolean } | undefined;

export async function updatePassword(_: ResetState, form: FormData): Promise<ResetState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password.length > 72) return { error: "A senha aceita até 72 caracteres." };
  if (password !== confirm) return { error: "As senhas estão diferentes. Digite a mesma senha nos dois campos." };
  const user = await getSessionUser();
  if (!user) redirect("/entrar?erro=link");
  const result = await setPassword(password);
  if (result === "same_password") return { error: "Escolha uma senha diferente da atual." };
  if (result === "weak_password") return { error: "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números." };
  if (result === "error") return { error: "Não foi possível salvar a nova senha. Tente de novo em instantes." };
  return { ok: true };
}
