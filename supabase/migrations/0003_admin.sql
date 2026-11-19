-- Kentro Academy: backend do painel /admin. Migration aditiva (sem drop de tabela, coluna ou policy).

-- ===== Colunas novas =====
-- Aula nova nasce rascunho (a action manda false); as existentes ficam publicadas.
alter table public.lessons add column published boolean not null default true;

alter table public.lesson_questions
  add column answer_seen_at timestamptz,
  add column answered_by uuid references auth.users on delete set null;

-- ===== Índices =====
create index lesson_questions_pending_idx on public.lesson_questions (created_at) where answer is null;
create index lesson_questions_unseen_idx on public.lesson_questions (user_id) where answer is not null and answer_seen_at is null;
create index lesson_questions_answered_by_idx on public.lesson_questions (answered_by) where answered_by is not null;
create index module_lessons_module_position_idx on public.module_lessons (module_id, position);
-- Um vídeo = uma aula (a action avisa antes; o índice garante mesmo em corrida).
create unique index lessons_youtube_id_key on public.lessons (youtube_id) where youtube_id is not null;

-- ===== Rascunho invisível para o aluno, no banco =====
-- Policies restritivas somam condição às permissivas existentes (nada é dropado).
create policy "aula publicada" on public.lessons as restrictive for select to authenticated
  using (published or (select public.is_admin()));
create policy "modulo_aulas de aula publicada" on public.module_lessons as restrictive for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.lessons l where l.id = module_lessons.lesson_id));
create policy "capitulos de aula publicada" on public.chapters as restrictive for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.lessons l where l.id = chapters.lesson_id));
create policy "materiais de aula publicada" on public.materials as restrictive for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.lessons l where l.id = materials.lesson_id));

-- ===== Constraints (dados atuais passam; validadas em seguida) =====
alter table public.quiz_questions
  add constraint quiz_options_count check (cardinality(options) between 2 and 6) not valid,
  add constraint quiz_correct_range check (correct >= 0 and correct < cardinality(options)) not valid,
  add constraint quiz_question_nonblank check (length(btrim(question)) > 0) not valid;
alter table public.quiz_questions
  validate constraint quiz_options_count, validate constraint quiz_correct_range, validate constraint quiz_question_nonblank;

alter table public.lessons
  add constraint lessons_youtube_id_format check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$') not valid,
  add constraint lessons_duration_nonneg check (duration_seconds >= 0) not valid;
alter table public.lessons validate constraint lessons_youtube_id_format, validate constraint lessons_duration_nonneg;

alter table public.materials add constraint materials_url_http check (url ~* '^https?://') not valid;
alter table public.materials validate constraint materials_url_http;

alter table public.chapters add constraint chapters_start_nonneg check (start_seconds >= 0) not valid;
alter table public.chapters validate constraint chapters_start_nonneg;

alter table public.tracks
  add constraint tracks_slug_format check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid,
  add constraint tracks_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$') not valid;
alter table public.tracks validate constraint tracks_slug_format, validate constraint tracks_color_hex;

-- ===== Aluno: marcar respostas como vistas =====
create or replace function public.mark_answers_seen(p_lesson text default null)
returns void language sql security definer set search_path = ''
as $$
  update public.lesson_questions
     set answer_seen_at = now()
   where user_id = auth.uid()
     and answer is not null
     and answer_seen_at is null
     and (p_lesson is null or lesson_id = p_lesson)
$$;
revoke execute on function public.mark_answers_seen(text) from public, anon;
grant execute on function public.mark_answers_seen(text) to authenticated;

-- ===== RPCs atômicas de admin (conferem is_admin() dentro) =====
create or replace function public.admin_save_quiz(p_module uuid, p_questions jsonb)
returns int language plpgsql security definer set search_path = ''
as $$
declare q jsonb; i int := 0; v_opts text[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) > 50 then
    raise exception 'invalid_quiz' using errcode = '22023';
  end if;
  if not exists (select 1 from public.modules where id = p_module) then
    raise exception 'module_not_found' using errcode = 'P0002';
  end if;
  delete from public.quiz_questions where module_id = p_module;
  for q in select * from jsonb_array_elements(p_questions) loop
    i := i + 1;
    select array_agg(o order by n) into v_opts from jsonb_array_elements_text(q->'options') with ordinality t(o, n);
    insert into public.quiz_questions (module_id, position, question, options, correct, explanation)
    values (p_module, i, btrim(q->>'question'), v_opts, (q->>'correct')::int, nullif(btrim(coalesce(q->>'explanation', '')), ''));
  end loop;
  return i;
end $$;
revoke execute on function public.admin_save_quiz(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_quiz(uuid, jsonb) to authenticated;

-- Cria (p_id null: rascunho no fim de p_module) ou edita a aula, e troca capítulos e materiais, tudo numa transação.
-- p_data: {youtube_id, title, summary, duration_seconds, steps[], chapters[{start_seconds,title}], materials[{title,url,description}]}
create or replace function public.admin_save_lesson(p_id text, p_module uuid, p_data jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_id text := p_id;
  v_yt text := nullif(btrim(coalesce(p_data->>'youtube_id', '')), '');
  v_steps text[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(array_agg(s order by n), '{}') into v_steps
    from jsonb_array_elements_text(coalesce(p_data->'steps', '[]'::jsonb)) with ordinality t(s, n);

  if v_id is null then
    if p_module is null then raise exception 'module_required' using errcode = '22023'; end if;
    v_id := coalesce(v_yt, replace(gen_random_uuid()::text, '-', ''));
    insert into public.lessons (id, youtube_id, title, duration_seconds, summary, steps, published)
    values (v_id, v_yt, btrim(p_data->>'title'), coalesce((p_data->>'duration_seconds')::int, 0),
            nullif(btrim(coalesce(p_data->>'summary', '')), ''), v_steps, false);
    insert into public.module_lessons (module_id, lesson_id, position)
    select p_module, v_id, coalesce(max(position), 0) + 1 from public.module_lessons where module_id = p_module;
  else
    update public.lessons
       set youtube_id = v_yt, title = btrim(p_data->>'title'),
           duration_seconds = coalesce((p_data->>'duration_seconds')::int, 0),
           summary = nullif(btrim(coalesce(p_data->>'summary', '')), ''), steps = v_steps
     where id = v_id;
    if not found then raise exception 'lesson_not_found' using errcode = 'P0002'; end if;
  end if;

  delete from public.chapters where lesson_id = v_id;
  insert into public.chapters (lesson_id, start_seconds, title)
  select v_id, (e->>'start_seconds')::int, btrim(e->>'title')
    from jsonb_array_elements(coalesce(p_data->'chapters', '[]'::jsonb)) e;

  delete from public.materials where lesson_id = v_id;
  insert into public.materials (lesson_id, title, description, url, position)
  select v_id, btrim(e->>'title'), nullif(btrim(coalesce(e->>'description', '')), ''), btrim(e->>'url'), n::int
    from jsonb_array_elements(coalesce(p_data->'materials', '[]'::jsonb)) with ordinality t(e, n);

  return v_id;
end $$;
revoke execute on function public.admin_save_lesson(text, uuid, jsonb) from public, anon;
grant execute on function public.admin_save_lesson(text, uuid, jsonb) to authenticated;

-- Vincula uma aula existente ao fim de um módulo (idempotente).
create or replace function public.admin_link_lesson(p_module uuid, p_lesson text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.module_lessons (module_id, lesson_id, position)
  select p_module, p_lesson, coalesce(max(position), 0) + 1 from public.module_lessons where module_id = p_module
  on conflict do nothing;
end $$;
revoke execute on function public.admin_link_lesson(uuid, text) from public, anon;
grant execute on function public.admin_link_lesson(uuid, text) to authenticated;

-- Reordenação: reescreve position de uma vez (1..n na ordem recebida).
create or replace function public.admin_reorder_tracks(p_ids text[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.tracks t set position = o.n::int from unnest(p_ids) with ordinality o(id, n) where t.id = o.id;
end $$;

create or replace function public.admin_reorder_modules(p_track text, p_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.modules m set position = o.n::int from unnest(p_ids) with ordinality o(id, n)
   where m.id = o.id and m.track_id = p_track;
end $$;

create or replace function public.admin_reorder_module_lessons(p_module uuid, p_ids text[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.module_lessons ml set position = o.n::int from unnest(p_ids) with ordinality o(id, n)
   where ml.module_id = p_module and ml.lesson_id = o.id;
end $$;

create or replace function public.admin_reorder_news(p_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.news n set position = o.n::int from unnest(p_ids) with ordinality o(id, n) where n.id = o.id;
end $$;

revoke execute on function public.admin_reorder_tracks(text[]) from public, anon;
revoke execute on function public.admin_reorder_modules(text, uuid[]) from public, anon;
revoke execute on function public.admin_reorder_module_lessons(uuid, text[]) from public, anon;
revoke execute on function public.admin_reorder_news(uuid[]) from public, anon;
grant execute on function public.admin_reorder_tracks(text[]) to authenticated;
grant execute on function public.admin_reorder_modules(text, uuid[]) to authenticated;
grant execute on function public.admin_reorder_module_lessons(uuid, text[]) to authenticated;
grant execute on function public.admin_reorder_news(uuid[]) to authenticated;

-- ===== Certificado (Fase 3) =====
-- Trilha concluída = todas as aulas publicadas COM vídeo concluídas + nota >= 70% em cada módulo que tenha perguntas.
-- security invoker: lê só o que o próprio usuário já pode ler (RLS); usa auth.uid().
create or replace function public.track_completion(p_track text)
returns table (completed boolean, completed_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  with req as (
    select distinct l.id
      from public.module_lessons ml
      join public.modules m on m.id = ml.module_id
      join public.lessons l on l.id = ml.lesson_id
     where m.track_id = p_track and l.youtube_id is not null and l.published
  ),
  done as (
    select lp.lesson_id, lp.completed_at from public.lesson_progress lp
     where lp.user_id = auth.uid() and lp.lesson_id in (select id from req)
  ),
  passed as (
    select m.id,
           (select min(a.created_at) from public.quiz_attempts a
             where a.user_id = auth.uid() and a.module_id = m.id and a.total > 0 and a.score * 100 >= 70 * a.total) as at
      from public.modules m
     where m.track_id = p_track and exists (select 1 from public.quiz_questions q where q.module_id = m.id)
  ),
  r as (
    select exists (select 1 from req)
           and not exists (select 1 from req where id not in (select lesson_id from done))
           and not exists (select 1 from passed where at is null) as ok
  )
  select r.ok,
         case when r.ok then greatest((select max(d.completed_at) from done d), (select max(p.at) from passed p)) end
    from r
$$;
revoke execute on function public.track_completion(text) from public, anon;
grant execute on function public.track_completion(text) to authenticated;
