-- 0007: recursos de aprendizado (redesign Órbita, fase 6)
-- 1. Pontos-chave por aula (editáveis no admin)
-- 2. Onde o aluno parou em cada vídeo, salvo na conta (vale em qualquer aparelho)
-- 3. "Reveja a aula X": cada pergunta do quiz pode apontar a aula que explica o assunto
-- O app funciona antes e depois desta migração: sem ela, esses recursos só ficam escondidos.

-- ===== 1. Pontos-chave =====
alter table public.lessons add column if not exists key_points text[] not null default '{}';
alter table public.lessons drop constraint if exists lessons_key_points_max;
alter table public.lessons add constraint lessons_key_points_max check (cardinality(key_points) <= 8);

-- ===== 2. Posição do vídeo =====
create table if not exists public.video_progress (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lesson_id text not null references public.lessons on delete cascade,
  seconds int not null check (seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists video_progress_lesson_idx on public.video_progress (lesson_id);
alter table public.video_progress enable row level security;
drop policy if exists "meu video" on public.video_progress;
create policy "meu video" on public.video_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.video_progress from anon;
grant select, insert, update, delete on public.video_progress to authenticated;

-- ===== 3. Aula para rever em cada pergunta =====
alter table public.quiz_questions add column if not exists lesson_id text references public.lessons on delete set null;
-- O aluno pode ler a aula indicada (não é gabarito); "correct" e "explanation" continuam fora do alcance dele.
grant select (lesson_id) on public.quiz_questions to authenticated;

-- Mesmo corpo da 0004, agora gravando lesson_id (só se a aula estiver neste módulo; senão fica vazio).
create or replace function public.admin_save_quiz(p_module uuid, p_questions jsonb)
returns int language plpgsql security invoker set search_path = ''
as $$
declare q jsonb; i int := 0; v_opts text[]; v_lesson text;
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
    select ml.lesson_id into v_lesson from public.module_lessons ml
     where ml.module_id = p_module and ml.lesson_id = nullif(q->>'lesson_id', '');
    insert into public.quiz_questions (module_id, position, question, options, correct, explanation, lesson_id)
    values (p_module, i, btrim(q->>'question'), v_opts, (q->>'correct')::int, nullif(btrim(coalesce(q->>'explanation', '')), ''), v_lesson);
  end loop;
  return i;
end $$;
revoke execute on function public.admin_save_quiz(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_quiz(uuid, jsonb) to authenticated;
