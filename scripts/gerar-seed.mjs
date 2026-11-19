// Gera supabase/seed.sql com as 6 trilhas e as aulas reais do protótipo
// (que por sua vez vêm do mapa-de-conteudo.md). Rode uma vez: node scripts/gerar-seed.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(dir, '../../prototipo/index.html'), 'utf8');
const grab = (start, end) => html.slice(html.indexOf(start) + start.length, html.indexOf(end, html.indexOf(start)));
const TRACKS = Function(`return ${grab('const TRACKS=', ';\nconst ROLES')}`)();

const q = v => v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const arr = a => `array[${a.map(q).join(',')}]::text[]`;
const sec = d => { if (!d) return 0; const [m, s] = d.split(':').map(Number); return m * 60 + s; };

const out = ['-- Gerado por scripts/gerar-seed.mjs a partir do protótipo. Não editar à mão.', 'begin;'];
const lessons = new Map();
TRACKS.forEach((t, ti) => {
  out.push(`insert into public.tracks (id,name,audience,icon,color,pitch,outcomes,position) values (${q(t.id)},${q(t.n)},${q(t.r)},${q(t.ic)},${q(t.c)},${q(t.p)},${arr(t.o)},${ti});`);
  t.m.forEach(([title, ls], mi) => {
    const mid = randomUUID();
    out.push(`insert into public.modules (id,track_id,title,position) values ('${mid}',${q(t.id)},${q(title)},${mi});`);
    ls.forEach(([lt, d, v], li) => {
      if (!lessons.has(v)) lessons.set(v, { t: lt, d, v });
      out.push(`insert into public.module_lessons (module_id,lesson_id,position) values ('${mid}',${q(v)},${li});`);
    });
  });
});
// aulas antes dos vínculos
const lessonRows = [...lessons.values()].map(l =>
  `insert into public.lessons (id,youtube_id,title,duration_seconds) values (${q(l.v)},${l.v.startsWith('faq') ? 'null' : q(l.v)},${q(l.t)},${sec(l.d)});`);
out.splice(2, 0, ...lessonRows);
// Capítulos e novidades do protótipo eram exemplos: não vão para o banco.
out.push('commit;');
await writeFile(join(dir, '../supabase/seed.sql'), out.join('\n') + '\n');
console.log(`trilhas ${TRACKS.length} · aulas únicas ${lessons.size} · linhas ${out.length}`);
