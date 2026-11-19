// Gera src/lib/covers.data.json a partir de public/covers/credits-*.json.
// Só entram fotos cujo arquivo .jpg existe. Rode: node scripts/build-covers.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = "public/covers";
const out = {};
for (const f of readdirSync(dir).filter((n) => /^credits-.*\.json$/.test(n)).sort()) {
  for (const c of JSON.parse(readFileSync(join(dir, f), "utf8"))) {
    if (!existsSync(join(dir, c.file))) continue;
    const src = c.source === "pexels" ? "Pexels" : "Unsplash";
    out[c.file.replace(/\.jpg$/, "")] = { alt: c.alt_pt, credit: `Foto: ${c.photographer} / ${src}`, page: c.page_url };
  }
}
writeFileSync("src/lib/covers.data.json", JSON.stringify(out, null, 2) + "\n");
console.log(Object.keys(out).length, "capas:", Object.keys(out).join(", "));
