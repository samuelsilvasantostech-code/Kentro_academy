-- 0008: texto explicativo de cada aula (artigo abaixo do vídeo)
-- Fica numa tabela própria para o rascunho não vazar: o aluno só lê texto publicado de aula publicada.
-- O app funciona antes e depois desta migração: sem ela, o artigo e o campo no admin ficam escondidos.

create table if not exists public.lesson_texts (
  lesson_id text primary key references public.lessons on delete cascade,
  body text not null default '' check (char_length(body) <= 30000),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.lesson_texts enable row level security;

drop policy if exists "ler texto publicado" on public.lesson_texts;
create policy "ler texto publicado" on public.lesson_texts for select to authenticated
  using (
    (select public.is_admin())
    or (published and exists (select 1 from public.lessons l where l.id = lesson_id and l.published))
  );

drop policy if exists "admin edita texto" on public.lesson_texts;
create policy "admin edita texto" on public.lesson_texts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.lesson_texts from anon;
grant select, insert, update, delete on public.lesson_texts to authenticated;
