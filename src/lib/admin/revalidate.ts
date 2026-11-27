import { revalidatePath, updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/db/types";

/** Depois de mudar trilha, módulo ou aula: limpa o catálogo guardado e as páginas. Só em Server Actions. */
export function catalogChanged() {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
}
