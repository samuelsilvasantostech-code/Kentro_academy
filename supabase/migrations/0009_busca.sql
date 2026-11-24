-- 0009: busca completa de aulas (título, resumo, passos, texto da aula e transcrição do vídeo)
-- O app funciona antes e depois desta migração: sem ela, /buscar usa a busca em memória e o campo
-- de transcrição some do admin.
--
-- Privacidade: a transcrição crua (com erros do reconhecimento automático e, às vezes, nomes de
-- clientes) NUNCA chega ao aluno. Ela fica numa tabela só do admin (lesson_transcripts); o aluno
-- só enxerga o índice de busca (lesson_transcript_index: tsvector, sem o texto), e apenas de aula publicada.
-- Obs.: privilégio por coluna não separa admin de aluno (os dois são "authenticated"), por isso são duas tabelas.
-- Nenhuma função SECURITY DEFINER nova: tudo roda com as permissões de quem chama (RLS vale).

-- ---------- 1. unaccent ----------
create extension if not exists unaccent with schema extensions;

-- Wrapper imutável (a unaccent original é STABLE e não entra em índice nem coluna gerada).
-- Dicionário explícito e search_path vazio: nada depende do search_path de quem chama.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- ---------- 2. transcrição crua (só admin) ----------
create table if not exists public.lesson_transcripts (
  lesson_id text primary key references public.lessons on delete cascade,
  body text not null default '' check (char_length(body) <= 200000),
  updated_at timestamptz not null default now()
);
alter table public.lesson_transcripts enable row level security;

drop policy if exists "admin gerencia transcricao" on public.lesson_transcripts;
create policy "admin gerencia transcricao" on public.lesson_transcripts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.lesson_transcripts from anon;
grant select, insert, update, delete on public.lesson_transcripts to authenticated;

-- ---------- 3. índice de busca (o aluno lê só isto) ----------
create table if not exists public.lesson_transcript_index (
  lesson_id text primary key references public.lessons on delete cascade,
  tsv tsvector not null
);
create index if not exists lesson_transcript_index_tsv_idx on public.lesson_transcript_index using gin (tsv);
alter table public.lesson_transcript_index enable row level security;

drop policy if exists "ler indice de aula publicada" on public.lesson_transcript_index;
create policy "ler indice de aula publicada" on public.lesson_transcript_index for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.lessons l where l.id = lesson_id and l.published)
  );

drop policy if exists "admin edita indice" on public.lesson_transcript_index;
create policy "admin edita indice" on public.lesson_transcript_index for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.lesson_transcript_index from anon;
grant select, insert, update, delete on public.lesson_transcript_index to authenticated;

-- Mantém o índice em dia a cada gravação da transcrição (SECURITY INVOKER: quem grava é o admin
-- ou o dono do banco no SQL Editor, os dois com permissão no índice).
create or replace function public.lesson_transcripts_sync()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.lesson_transcript_index where lesson_id = old.lesson_id;
    return old;
  end if;
  insert into public.lesson_transcript_index (lesson_id, tsv)
  -- strip(): guarda só as palavras, sem posição nem ordem, para o índice não permitir remontar a fala
  values (new.lesson_id, strip(to_tsvector('portuguese', public.f_unaccent(new.body))))
  on conflict (lesson_id) do update set tsv = excluded.tsv;
  return new;
end
$$;

drop trigger if exists lesson_transcripts_sync on public.lesson_transcripts;
create trigger lesson_transcripts_sync
  after insert or update of body or delete on public.lesson_transcripts
  for each row execute function public.lesson_transcripts_sync();

-- ---------- 4. busca ----------
-- search_lessons(q, groups)
--   q       texto digitado pelo aluno (linguagem natural).
--   groups  opcional: [["criar*","cadastrar"],["usuario","agente"]]. Cada grupo é um conceito (as
--           palavras dele são alternativas, ex. sinônimos); os grupos se combinam com E. "palavra*" = prefixo.
--           Sem groups, cada palavra de q vira um grupo (a última com prefixo).
-- Palavras vazias do português (como, de, para...) somem sozinhas na configuração 'portuguese';
-- plural/singular e conjugações caem no mesmo radical; acento é ignorado.
-- Tenta E; se vierem menos de 3 aulas, cai para OU. Pesos: A título, B resumo/passos/módulo,
-- C texto publicado da aula, D transcrição. Devolve só aulas publicadas.
-- matched: onde casou com mais força (title | summary | text | transcript).
create or replace function public.search_lessons(q text, groups jsonb default null)
returns table (lesson_id text, rank real, matched text)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  g jsonb; gw text; word text; wq tsquery; gq tsquery;
  qa tsquery := ''::tsquery;
  qo tsquery := ''::tsquery;
  gi int := 0; wi int;
begin
  if q is null or char_length(q) > 200 then return; end if;

  if groups is null or jsonb_typeof(groups) <> 'array' then
    select coalesce(jsonb_agg(jsonb_build_array(case when t.n = t.total then t.tok || '*' else t.tok end) order by t.n), '[]'::jsonb)
      into groups
      from (
        select tok, row_number() over () as n, count(*) over () as total
        from unnest(regexp_split_to_array(lower(public.f_unaccent(q)), '[^a-z0-9]+')) as tok
        where tok <> ''
      ) t;
  end if;

  for g in select * from jsonb_array_elements(groups) loop
    exit when gi >= 8;
    gi := gi + 1;
    if jsonb_typeof(g) <> 'array' then continue; end if;
    gq := ''::tsquery; wi := 0;
    for gw in select jsonb_array_elements_text(g) loop
      exit when wi >= 6;
      wi := wi + 1;
      word := regexp_replace(lower(public.f_unaccent(gw)), '[^a-z0-9]', '', 'g');
      if char_length(word) < 2 then continue; end if;
      wq := to_tsquery('portuguese', word || case when right(gw, 1) = '*' then ':*' else '' end);
      gq := gq || wq;
      qo := qo || wq;
    end loop;
    qa := qa && gq;
  end loop;

  if numnode(qo) = 0 then return; end if;

  return query
  with d as (
    select l.id, l.title,
      setweight(to_tsvector('portuguese', public.f_unaccent(l.title)), 'A') as ta,
      setweight(to_tsvector('portuguese', public.f_unaccent(
        coalesce(l.summary, '') || ' ' || coalesce(array_to_string(l.steps, ' '), '') || ' ' || coalesce(mt.titles, ''))), 'B') as tb,
      setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(x.body, ''))), 'C') as tc,
      setweight(coalesce(ix.tsv, ''::tsvector), 'D') as td
    from public.lessons l
    left join lateral (
      select string_agg(m.title, ' ') as titles
      from public.module_lessons ml join public.modules m on m.id = ml.module_id
      where ml.lesson_id = l.id
    ) mt on true
    left join public.lesson_texts x on x.lesson_id = l.id and x.published
    left join public.lesson_transcript_index ix on ix.lesson_id = l.id
    where l.published
  ), doc as (
    select d.*, d.ta || d.tb || d.tc || d.td as tsv from d
  )
  select dd.id, ts_rank('{0.1,0.2,0.4,1.0}'::float4[], dd.tsv, uq.sel, 1) as rank,
    case when dd.ta @@ uq.sel then 'title' when dd.tb @@ uq.sel then 'summary'
         when dd.tc @@ uq.sel then 'text' else 'transcript' end as matched
  from doc dd
  cross join lateral (
    select case when (select count(*) from doc d2 where d2.tsv @@ qa) >= 3 and numnode(qa) > 0 then qa else qo end as sel
  ) uq
  where dd.tsv @@ uq.sel
  order by 2 desc, dd.title
  limit 50;
end
$$;

revoke execute on function public.search_lessons(text, jsonb) from public, anon;
grant execute on function public.search_lessons(text, jsonb) to authenticated;
