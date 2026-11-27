"use server";

import { conferirDados, copiarDados, requireAdmin, type MigracaoResult } from "@/lib/db/admin";

/** Copia todos os dados do banco atual para o banco do Doca (substitui o que houver no destino) e confere. */
export async function copiarAction(): Promise<MigracaoResult> {
  return copiarDados(await requireAdmin());
}

/** Só confere origem x destino, tabela por tabela. Não grava nada. */
export async function conferirAction(): Promise<MigracaoResult> {
  return conferirDados(await requireAdmin());
}
