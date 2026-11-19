-- Kentro Academy: correções da revisão de segurança da Fase 1. Aditiva: sem drop de tabela, coluna ou policy.

-- ===== 1. RPCs de admin passam a rodar como o chamador (RLS vale; is_admin() continua conferido dentro) =====
alter function public.admin_link_lesson(uuid, text) security invoker;
alter function public.admin_save_lesson(text, uuid, jsonb) security invoker;

-- ===== 2. Concorrência e posições sem empate (corpos mantidos, agora security invoker) =====
create or replace function public.admin_save_quiz(p_module uuid, p_questions jsonb)
returns int language plpgsql security invoker set search_path = ''
as $$
declare q jsonb; i int := 0; v_opts text[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  -- Serializa salvamentos concorrentes do mesmo quiz.
  perform 1 from public.modules where id = p_module for update;
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

-- Reordenação: os ids recebidos vêm primeiro (na ordem recebida); o resto segue depois na ordem atual. Tudo recompactado em 1..n.
create or replace function public.admin_reorder_tracks(p_ids text[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_reorder_tracks'));
  with want as (select id, min(n) n from unnest(p_ids) with ordinality o(id, n) group by id),
  ord as (
    select t.id, row_number() over (order by coalesce(w.n, 2147483647), t.position, t.id) rn
      from public.tracks t left join want w on w.id = t.id
  )
  update public.tracks t set position = ord.rn::int from ord where t.id = ord.id and t.position is distinct from ord.rn::int;
end $$;

create or replace function public.admin_reorder_modules(p_track text, p_ids uuid[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_reorder_modules'));
  with want as (select id, min(n) n from unnest(p_ids) with ordinality o(id, n) group by id),
  ord as (
    select m.id, row_number() over (order by coalesce(w.n, 2147483647), m.position, m.id) rn
      from public.modules m left join want w on w.id = m.id where m.track_id = p_track
  )
  update public.modules m set position = ord.rn::int from ord where m.id = ord.id and m.position is distinct from ord.rn::int;
end $$;

create or replace function public.admin_reorder_module_lessons(p_module uuid, p_ids text[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_reorder_module_lessons'));
  with want as (select id, min(n) n from unnest(p_ids) with ordinality o(id, n) group by id),
  ord as (
    select ml.lesson_id, row_number() over (order by coalesce(w.n, 2147483647), ml.position, ml.lesson_id) rn
      from public.module_lessons ml left join want w on w.id = ml.lesson_id where ml.module_id = p_module
  )
  update public.module_lessons ml set position = ord.rn::int
    from ord where ml.module_id = p_module and ml.lesson_id = ord.lesson_id and ml.position is distinct from ord.rn::int;
end $$;

create or replace function public.admin_reorder_news(p_ids uuid[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('admin_reorder_news'));
  with want as (select id, min(n) n from unnest(p_ids) with ordinality o(id, n) group by id),
  ord as (
    select n.id, row_number() over (order by coalesce(w.n, 2147483647), n.position, n.id) rn
      from public.news n left join want w on w.id = n.id
  )
  update public.news n set position = ord.rn::int from ord where n.id = ord.id and n.position is distinct from ord.rn::int;
end $$;

-- ===== 3. Trilha rascunho invisível para o aluno (módulos e perguntas) =====
create policy "modulo de trilha publicada" on public.modules as restrictive for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.tracks t where t.id = modules.track_id and t.published));
create policy "quiz de trilha publicada" on public.quiz_questions as restrictive for select to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.modules m join public.tracks t on t.id = m.track_id where m.id = quiz_questions.module_id and t.published));

-- ===== 4. submit_quiz: trilha publicada, limite de respostas e gabarito só para quem passou =====
-- Retorno jsonb: {score, total, passed, results: boolean[]} e, só se passed, {correct: int[], explanations: text[]}.
create or replace function public.submit_quiz(p_module uuid, p_answers int[])
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_correct int[]; v_expl text[]; v_results boolean[] := '{}'; v_score int := 0; v_total int; v_passed boolean; v_ok boolean;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if cardinality(p_answers) > 100 then raise exception 'too_many_answers' using errcode = '22023'; end if;
  select exists (select 1 from public.modules m join public.tracks t on t.id = m.track_id
                  where m.id = p_module and (t.published or public.is_admin())) into v_ok;
  if not v_ok then raise exception 'module_not_found' using errcode = 'P0002'; end if;
  select array_agg(correct order by position), array_agg(coalesce(explanation, '') order by position)
    into v_correct, v_expl from public.quiz_questions where module_id = p_module;
  v_total := coalesce(array_length(v_correct, 1), 0);
  if v_total = 0 then return null; end if;
  for i in 1..v_total loop
    v_results := v_results || coalesce(p_answers[i] = v_correct[i], false);
    if v_results[i] then v_score := v_score + 1; end if;
  end loop;
  insert into public.quiz_attempts (user_id, module_id, score, total) values (auth.uid(), p_module, v_score, v_total);
  v_passed := v_score * 100 >= 70 * v_total;
  if v_passed then
    return jsonb_build_object('score', v_score, 'total', v_total, 'passed', true, 'results', to_jsonb(v_results),
                              'correct', to_jsonb(v_correct), 'explanations', to_jsonb(v_expl));
  end if;
  return jsonb_build_object('score', v_score, 'total', v_total, 'passed', false, 'results', to_jsonb(v_results));
end $$;

-- ===== 5. Dúvida: o aluno só informa aula e texto (user_id vem de auth.uid(); resposta é do admin) =====
revoke insert on public.lesson_questions from authenticated;
grant insert (lesson_id, body) on public.lesson_questions to authenticated;

-- ===== 6. Limites de dados =====
alter table public.news add constraint news_href_safe check (href is null or href ~* '^(https?://|/[^/\\])') not valid;
alter table public.news validate constraint news_href_safe;
alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) <= 120) not valid,
  add constraint profiles_company_len check (char_length(company) <= 120) not valid,
  add constraint profiles_experience_len check (char_length(experience) <= 60) not valid;
alter table public.profiles
  validate constraint profiles_full_name_len, validate constraint profiles_company_len, validate constraint profiles_experience_len;

-- ===== 7. Privilégios desnecessários =====
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
