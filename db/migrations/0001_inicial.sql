-- Kentro Academy no Postgres do Doca: esquema inicial.
-- Equivale às migrações 0001–0009 do Supabase, com três diferenças:
--   1. Login próprio: users/sessions/auth_tokens/login_attempts no lugar de auth.users.
--   2. Sem RLS: o app filtra no servidor (src/lib/db/aluno e src/lib/db/admin).
--   3. As funções recebem o usuário como parâmetro (não há auth.uid()); as de admin conferem is_admin(p_admin) dentro.
-- Regras críticas continuam no banco: correção do quiz (submit_quiz), emissão de certificado (issue_certificate),
-- quiz sem gabarito para o aluno (view quiz_questions_aluno) e transcrição crua fora do alcance do aluno.
-- Aplicada uma única vez na subida do app (instrumentation.ts), dentro de uma transação.

-- ===================== Extensões =====================
create extension if not exists pgcrypto;

-- f_unaccent: imutável (entra em índice). Usa a extensão unaccent se o Doca permitir; senão, translate().
do $$
begin
  begin
    create extension if not exists unaccent;
    execute $f$
      create or replace function f_unaccent(text) returns text
      language sql immutable parallel safe strict
      as 'select public.unaccent(''public.unaccent''::regdictionary, $1)'
    $f$;
  exception when others then
    raise notice 'unaccent indisponível (%): usando translate()', sqlerrm;
    execute $f$
      create or replace function f_unaccent(text) returns text
      language sql immutable parallel safe strict
      as $b$ select translate($1,
        'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
        'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN') $b$
    $f$;
  end;
end $$;

-- ===================== Login =====================
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  password_hash text,                          -- bcrypt; null = convite ainda não aceito
  email_confirmed_at timestamptz,
  disabled_at timestamptz,                     -- desativado pelo admin: não entra mais
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_key on users (email);

-- Sessão: o cookie leva um token aleatório; aqui fica só o HMAC-SHA256 dele.
create table sessions (
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

-- Links de uso único (esqueci a senha, convite). Também só o HMAC do token.
create table auth_tokens (
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  purpose text not null check (purpose in ('reset', 'invite')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index auth_tokens_user_idx on auth_tokens (user_id);

-- Limite de tentativas de login (por e-mail e por IP).
create table login_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index login_attempts_key_idx on login_attempts (key, at);

-- ===================== Catálogo =====================
create table tracks (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  audience text not null default '',
  icon text not null default '📘',
  color text not null default '#8B5CF6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  pitch text not null default '',
  outcomes text[] not null default '{}',
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  track_id text not null references tracks on delete cascade,
  title text not null,
  position int not null default 0
);
create index modules_track_position_idx on modules (track_id, position);

create table lessons (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  youtube_id text check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  summary text,
  steps text[] not null default '{}',
  key_points text[] not null default '{}' check (cardinality(key_points) <= 8),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index lessons_youtube_id_key on lessons (youtube_id) where youtube_id is not null;

create table module_lessons (
  module_id uuid not null references modules on delete cascade,
  lesson_id text not null references lessons on delete cascade,
  position int not null default 0,
  primary key (module_id, lesson_id)
);
create index module_lessons_lesson_idx on module_lessons (lesson_id);
create index module_lessons_module_position_idx on module_lessons (module_id, position);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references lessons on delete cascade,
  start_seconds int not null check (start_seconds >= 0),
  title text not null
);
create index chapters_lesson_idx on chapters (lesson_id, start_seconds);

create table materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references lessons on delete cascade,
  title text not null,
  description text,
  url text not null check (url ~* '^https?://'),
  position int not null default 0
);
create index materials_lesson_idx on materials (lesson_id);

create table lesson_texts (
  lesson_id text primary key references lessons on delete cascade,
  body text not null default '' check (char_length(body) <= 30000),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules on delete cascade,
  position int not null default 0,
  question text not null check (length(btrim(question)) > 0),
  options text[] not null check (cardinality(options) between 2 and 6),
  correct int not null,
  explanation text,
  lesson_id text references lessons on delete set null,
  constraint quiz_correct_range check (correct >= 0 and correct < cardinality(options))
);
create index quiz_questions_module_idx on quiz_questions (module_id, position);

-- O que o aluno pode ler do quiz: sem "correct" nem "explanation", e só de trilha publicada.
create view quiz_questions_aluno as
  select q.id, q.module_id, q.position, q.question, q.options, q.lesson_id
    from quiz_questions q
    join modules m on m.id = q.module_id
    join tracks t on t.id = m.track_id
   where t.published;

create table news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  href text check (href is null or href ~* '^(https?://|/[^/\\])'),
  position int not null default 0,
  published boolean not null default true
);

-- ===================== Alunos =====================
create table profiles (
  id uuid primary key references users on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  company text check (char_length(company) <= 120),
  role_track text references tracks on delete set null,
  experience text check (char_length(experience) <= 60),
  is_admin boolean not null default false,
  last_track_id text,
  last_lesson_id text,
  created_at timestamptz not null default now()
);
create index profiles_role_track_idx on profiles (role_track);

create table lesson_progress (
  user_id uuid not null references users on delete cascade,
  lesson_id text not null references lessons on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on lesson_progress (lesson_id);

create table video_progress (
  user_id uuid not null references users on delete cascade,
  lesson_id text not null references lessons on delete cascade,
  seconds int not null check (seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index video_progress_lesson_idx on video_progress (lesson_id);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  module_id uuid not null references modules on delete cascade,
  score int not null,
  total int not null,
  created_at timestamptz not null default now()
);
create index quiz_attempts_user_idx on quiz_attempts (user_id);
create index quiz_attempts_module_idx on quiz_attempts (module_id);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  lesson_id text not null references lessons on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index notes_user_lesson_idx on notes (user_id, lesson_id);
create index notes_lesson_idx on notes (lesson_id);

create table lesson_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  lesson_id text not null references lessons on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  answer text,
  answered_at timestamptz,
  answered_by uuid references users on delete set null,
  answer_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index lesson_questions_lesson_idx on lesson_questions (lesson_id);
create index lesson_questions_user_idx on lesson_questions (user_id);
create index lesson_questions_pending_idx on lesson_questions (created_at) where answer is null;
create index lesson_questions_unseen_idx on lesson_questions (user_id) where answer is not null and answer_seen_at is null;
create index lesson_questions_answered_by_idx on lesson_questions (answered_by) where answered_by is not null;

-- Certificado conquistado é para sempre (uma linha por aluno e trilha). Só entra por issue_certificate.
create table track_certificates (
  user_id uuid not null references users on delete cascade,
  track_id text not null references tracks on delete cascade,
  issued_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
create index track_certificates_track_idx on track_certificates (track_id);

-- ===================== Busca =====================
-- Transcrição crua: só o admin lê (o app nunca a entrega ao aluno).
create table lesson_transcripts (
  lesson_id text primary key references lessons on delete cascade,
  body text not null default '' check (char_length(body) <= 200000),
  updated_at timestamptz not null default now()
);

-- Índice de busca: só palavras (strip), sem posição, para não permitir remontar a fala.
create table lesson_transcript_index (
  lesson_id text primary key references lessons on delete cascade,
  tsv tsvector not null
);
create index lesson_transcript_index_tsv_idx on lesson_transcript_index using gin (tsv);

create function lesson_transcripts_sync() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from lesson_transcript_index where lesson_id = old.lesson_id;
    return old;
  end if;
  insert into lesson_transcript_index (lesson_id, tsv)
  values (new.lesson_id, strip(to_tsvector('portuguese', f_unaccent(new.body))))
  on conflict (lesson_id) do update set tsv = excluded.tsv;
  return new;
end $$;

create trigger lesson_transcripts_sync
  after insert or update of body or delete on lesson_transcripts
  for each row execute function lesson_transcripts_sync();

-- search_lessons(q, groups): mesma regra da 0009 do Supabase. Devolve só aulas publicadas.
create function search_lessons(q text, groups jsonb default null)
returns table (lesson_id text, rank real, matched text)
language plpgsql stable
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
        from unnest(regexp_split_to_array(lower(f_unaccent(q)), '[^a-z0-9]+')) as tok
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
      word := regexp_replace(lower(f_unaccent(gw)), '[^a-z0-9]', '', 'g');
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
      setweight(to_tsvector('portuguese', f_unaccent(l.title)), 'A') as ta,
      setweight(to_tsvector('portuguese', f_unaccent(
        coalesce(l.summary, '') || ' ' || coalesce(array_to_string(l.steps, ' '), '') || ' ' || coalesce(mt.titles, ''))), 'B') as tb,
      setweight(to_tsvector('portuguese', f_unaccent(coalesce(x.body, ''))), 'C') as tc,
      setweight(coalesce(ix.tsv, ''::tsvector), 'D') as td
    from lessons l
    left join lateral (
      select string_agg(m.title, ' ') as titles
      from module_lessons ml join modules m on m.id = ml.module_id
      join tracks t on t.id = m.track_id and t.published
      where ml.lesson_id = l.id
    ) mt on true
    left join lesson_texts x on x.lesson_id = l.id and x.published
    left join lesson_transcript_index ix on ix.lesson_id = l.id
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
end $$;

-- ===================== Funções do aluno =====================
create function is_admin(p_user uuid) returns boolean
language sql stable
as $$ select coalesce((select p.is_admin from profiles p join users u on u.id = p.id
                        where p.id = p_user and u.disabled_at is null), false) $$;

-- Corrige o quiz no banco. Gabarito só volta para quem passou (>= 70%). Freio de 20 s por aluno e módulo.
create function submit_quiz(p_user uuid, p_module uuid, p_answers int[])
returns jsonb language plpgsql
as $$
declare
  v_correct int[]; v_expl text[]; v_results boolean[] := '{}'; v_score int := 0; v_total int; v_passed boolean; v_ok boolean;
begin
  if p_user is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if cardinality(p_answers) > 100 then raise exception 'too_many_answers' using errcode = '22023'; end if;
  select exists (select 1 from modules m join tracks t on t.id = m.track_id
                  where m.id = p_module and (t.published or is_admin(p_user))) into v_ok;
  if not v_ok then raise exception 'module_not_found' using errcode = 'P0002'; end if;
  -- Serializa tentativas simultâneas do mesmo aluno no mesmo módulo (o freio de 20 s vale mesmo em corrida).
  perform pg_advisory_xact_lock(hashtext('submit_quiz:' || p_user::text || ':' || p_module::text));
  select array_agg(correct order by position), array_agg(coalesce(explanation, '') order by position)
    into v_correct, v_expl from quiz_questions where module_id = p_module;
  v_total := coalesce(array_length(v_correct, 1), 0);
  if v_total = 0 then return null; end if;
  if p_answers is null or cardinality(p_answers) <> v_total or array_ndims(p_answers) <> 1
     or array_position(p_answers, null) is not null then
    raise exception 'invalid_answers' using errcode = '22023';
  end if;
  if exists (select 1 from quiz_attempts
              where user_id = p_user and module_id = p_module and created_at > now() - interval '20 seconds') then
    raise exception 'too_fast' using errcode = '54000';
  end if;
  for i in 1..v_total loop
    v_results := v_results || coalesce(p_answers[i] = v_correct[i], false);
    if v_results[i] then v_score := v_score + 1; end if;
  end loop;
  insert into quiz_attempts (user_id, module_id, score, total) values (p_user, p_module, v_score, v_total);
  v_passed := v_score * 100 >= 70 * v_total;
  if v_passed then
    return jsonb_build_object('score', v_score, 'total', v_total, 'passed', true, 'results', to_jsonb(v_results),
                              'correct', to_jsonb(v_correct), 'explanations', to_jsonb(v_expl));
  end if;
  return jsonb_build_object('score', v_score, 'total', v_total, 'passed', false, 'results', to_jsonb(v_results));
end $$;

-- Trilha concluída = todas as aulas publicadas COM vídeo concluídas + nota >= 70% em cada módulo com perguntas.
create function track_completion(p_user uuid, p_track text)
returns table (completed boolean, completed_at timestamptz)
language sql stable
as $$
  with req as (
    select distinct l.id
      from module_lessons ml
      join modules m on m.id = ml.module_id
      join lessons l on l.id = ml.lesson_id
     where m.track_id = p_track and l.youtube_id is not null and l.published
  ),
  done as (
    select lp.lesson_id, lp.completed_at from lesson_progress lp
     where lp.user_id = p_user and lp.lesson_id in (select id from req)
  ),
  passed as (
    select m.id,
           (select min(a.created_at) from quiz_attempts a
             where a.user_id = p_user and a.module_id = m.id and a.total > 0 and a.score * 100 >= 70 * a.total) as at
      from modules m
     where m.track_id = p_track and exists (select 1 from quiz_questions q where q.module_id = m.id)
  ),
  r as (
    select p_user is not null
           and exists (select 1 from tracks t where t.id = p_track and t.published)
           and exists (select 1 from req)
           and not exists (select 1 from req where id not in (select lesson_id from done))
           and not exists (select 1 from passed where at is null) as ok
  )
  select r.ok,
         case when r.ok then greatest((select max(d.completed_at) from done d), (select max(p.at) from passed p)) end
    from r
$$;

-- Emite o certificado se a trilha estiver concluída (data = conclusão). Idempotente: devolve a data já emitida.
create function issue_certificate(p_user uuid, p_track text)
returns timestamptz language plpgsql
as $$
declare v_done boolean; v_at timestamptz; v_issued timestamptz;
begin
  select issued_at into v_issued from track_certificates where user_id = p_user and track_id = p_track;
  if found then return v_issued; end if;
  select c.completed, c.completed_at into v_done, v_at from track_completion(p_user, p_track) c;
  if not coalesce(v_done, false) or v_at is null then return null; end if;
  insert into track_certificates (user_id, track_id, issued_at) values (p_user, p_track, v_at)
  on conflict (user_id, track_id) do nothing;
  select issued_at into v_issued from track_certificates where user_id = p_user and track_id = p_track;
  return v_issued;
end $$;

create function mark_answers_seen(p_user uuid, p_lesson text default null)
returns void language sql
as $$
  update lesson_questions
     set answer_seen_at = now()
   where user_id = p_user
     and answer is not null
     and answer_seen_at is null
     and (p_lesson is null or lesson_id = p_lesson)
$$;

-- ===================== Funções do admin (conferem is_admin(p_admin)) =====================
create function admin_save_quiz(p_admin uuid, p_module uuid, p_questions jsonb)
returns int language plpgsql
as $$
declare q jsonb; i int := 0; v_opts text[]; v_lesson text;
begin
  if not is_admin(p_admin) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from modules where id = p_module for update;
  if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) > 50 then
    raise exception 'invalid_quiz' using errcode = '22023';
  end if;
  if not exists (select 1 from modules where id = p_module) then
    raise exception 'module_not_found' using errcode = 'P0002';
  end if;
  delete from quiz_questions where module_id = p_module;
  for q in select * from jsonb_array_elements(p_questions) loop
    i := i + 1;
    select array_agg(o order by n) into v_opts from jsonb_array_elements_text(q->'options') with ordinality t(o, n);
    v_lesson := null;
    select ml.lesson_id into v_lesson from module_lessons ml
     where ml.module_id = p_module and ml.lesson_id = nullif(q->>'lesson_id', '');
    insert into quiz_questions (module_id, position, question, options, correct, explanation, lesson_id)
    values (p_module, i, btrim(q->>'question'), v_opts, (q->>'correct')::int, nullif(btrim(coalesce(q->>'explanation', '')), ''), v_lesson);
  end loop;
  return i;
end $$;

-- Cria (p_id null: rascunho no fim de p_module) ou edita a aula, e troca capítulos e materiais, tudo numa transação.
create function admin_save_lesson(p_admin uuid, p_id text, p_module uuid, p_data jsonb)
returns text language plpgsql
as $$
declare
  v_id text := p_id;
  v_yt text := nullif(btrim(coalesce(p_data->>'youtube_id', '')), '');
  v_steps text[];
begin
  if not is_admin(p_admin) then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(array_agg(s order by n), '{}') into v_steps
    from jsonb_array_elements_text(coalesce(p_data->'steps', '[]'::jsonb)) with ordinality t(s, n);

  if v_id is null then
    if p_module is null then raise exception 'module_required' using errcode = '22023'; end if;
    v_id := coalesce(v_yt, replace(gen_random_uuid()::text, '-', ''));
    insert into lessons (id, youtube_id, title, duration_seconds, summary, steps, published)
    values (v_id, v_yt, btrim(p_data->>'title'), coalesce((p_data->>'duration_seconds')::int, 0),
            nullif(btrim(coalesce(p_data->>'summary', '')), ''), v_steps, false);
    insert into module_lessons (module_id, lesson_id, position)
    select p_module, v_id, coalesce(max(position), 0) + 1 from module_lessons where module_id = p_module;
  else
    update lessons
       set youtube_id = v_yt, title = btrim(p_data->>'title'),
           duration_seconds = coalesce((p_data->>'duration_seconds')::int, 0),
           summary = nullif(btrim(coalesce(p_data->>'summary', '')), ''), steps = v_steps
     where id = v_id;
    if not found then raise exception 'lesson_not_found' using errcode = 'P0002'; end if;
  end if;

  delete from chapters where lesson_id = v_id;
  insert into chapters (lesson_id, start_seconds, title)
  select v_id, (e->>'start_seconds')::int, btrim(e->>'title')
    from jsonb_array_elements(coalesce(p_data->'chapters', '[]'::jsonb)) e;

  delete from materials where lesson_id = v_id;
  insert into materials (lesson_id, title, description, url, position)
  select v_id, btrim(e->>'title'), nullif(btrim(coalesce(e->>'description', '')), ''), btrim(e->>'url'), n::int
    from jsonb_array_elements(coalesce(p_data->'materials', '[]'::jsonb)) with ordinality t(e, n);

  return v_id;
end $$;

create function admin_link_lesson(p_admin uuid, p_module uuid, p_lesson text)
returns void language plpgsql
as $$
begin
  if not is_admin(p_admin) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into module_lessons (module_id, lesson_id, position)
  select p_module, p_lesson, coalesce(max(position), 0) + 1 from module_lessons where module_id = p_module
  on conflict do nothing;
end $$;

-- Reordenação: os ids recebidos vêm primeiro (na ordem recebida); o resto segue na ordem atual. Recompacta em 1..n.
create function admin_reorder_tracks(p_admin uuid, p_ids text[])
returns void language plpgsql
as $$
begin
  if not is_admin(p_admin) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_reorder_tracks'));
  with want as (select id, min(n) n from unnest(p_ids) with ordinality o(id, n) group by id),
  ord as (
    select t.id, row_number() over (order by coalesce(w.n, 2147483647), t.position, t.id) rn
      from tracks t left join want w on w.id = t.id
  )
  update tracks t set position = ord.rn::int from ord where t.id = ord.id and t.position is distinct from ord.rn::int;
end $$;

create function admin_reorder_modules(p_admin uuid, p_track text, p_ids uuid[])
returns void language plpgsql
as $$
begin
  if not is_admin(p_admin) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_reorder_modules'));
  with want as (select id, min(n) n from unnest(p_ids) with ordinality o(id, n) group by id),
  ord as (
    select m.id, row_number() over (order by coalesce(w.n, 2147483647), m.position, m.id) rn
      from modules m left join want w on w.id = m.id where m.track_id = p_track
  )
  update modules m set position = ord.rn::int from ord where m.id = ord.id and m.position is distinct from ord.rn::int;
end $$;

create function admin_reorder_module_lessons(p_admin uuid, p_module uuid, p_ids text[])
returns void language plpgsql
as $$
begin
  if not is_admin(p_admin) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_reorder_module_lessons'));
  with want as (select id, min(n) n from unnest(p_ids) with ordinality o(id, n) group by id),
  ord as (
    select ml.lesson_id, row_number() over (order by coalesce(w.n, 2147483647), ml.position, ml.lesson_id) rn
      from module_lessons ml left join want w on w.id = ml.lesson_id where ml.module_id = p_module
  )
  update module_lessons ml set position = ord.rn::int
    from ord where ml.module_id = p_module and ml.lesson_id = ord.lesson_id and ml.position is distinct from ord.rn::int;
end $$;

create function admin_reorder_news(p_admin uuid, p_ids uuid[])
returns void language plpgsql
as $$
begin
  if not is_admin(p_admin) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_reorder_news'));
  with want as (select id, min(n) n from unnest(p_ids) with ordinality o(id, n) group by id),
  ord as (
    select n.id, row_number() over (order by coalesce(w.n, 2147483647), n.position, n.id) rn
      from news n left join want w on w.id = n.id
  )
  update news n set position = ord.rn::int from ord where n.id = ord.id and n.position is distinct from ord.rn::int;
end $$;
