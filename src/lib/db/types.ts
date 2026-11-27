/** Erro de banco no formato comum às implementações (código SQLSTATE quando houver). Null = sem erro. */
export type DbError = { code?: string; message?: string } | null;

/** Cache por pedido e chave de cache do catálogo ficam aqui para o admin e o aluno compartilharem a mesma tag. */
export const CATALOG_TAG = "catalogo";
