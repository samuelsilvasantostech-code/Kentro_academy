-- Kentro Academy: catálogo (trilhas, módulos, aulas) e dados de cada aluno.
-- Uma aula pode estar em várias trilhas (module_lessons); o progresso é por aula,
-- então concluir uma aula vale para todas as trilhas em que ela aparece.

-- ===== Catálogo =====
create table public.tracks (
  id text primary key,                       -- slug usado na URL: /trilha/atendente
  name text not null,
  audience text not null default '',
  icon text not null default '📘',
  color text not null default '#8B5CF6',
  pitch text not null default '',
  outcomes text[] not null default '{}',
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  track_id text not null references public.tracks on delete cascade,
  title text not null,
  position int not null default 0
);
create index on public.modules (track_id, position);

create table public.lessons (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  youtube_id text,                           -- vazio = aula sem vídeo
  title text not null,
  duration_seconds int not null default 0,
  summary text,
  steps text[] not null default '{}',        -- "Faça agora no seu Kentro"
  created_at timestamptz not null default now()
);

create table public.module_lessons (
  module_id uuid not null references public.modules on delete cascade,
  lesson_id text not null references public.lessons on delete cascade,
  position int not null default 0,
  primary key (module_id, lesson_id)
);
create index on public.module_lessons (lesson_id);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons on delete cascade,
  start_seconds int not null,
  title text not null
);
create index on public.chapters (lesson_id, start_seconds);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons on delete cascade,
  title text not null,
  description text,
  url text not null,
  position int not null default 0
);
create index on public.materials (lesson_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules on delete cascade,
  position int not null default 0,
  question text not null,
  options text[] not null,
  correct int not null,
  explanation text
);
create index on public.quiz_questions (module_id, position);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  href text,                                 -- vazio = "em breve"
  position int not null default 0,
  published boolean not null default true
);

-- ===== Alunos =====
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  company text,
  role_track text references public.tracks on delete set null,
  experience text,
  is_admin boolean not null default false,
  last_track_id text,
  last_lesson_id text,
  created_at timestamptz not null default now()
);

create table public.lesson_progress (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lesson_id text not null references public.lessons on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  module_id uuid not null references public.modules on delete cascade,
  score int not null,
  total int not null,
  created_at timestamptz not null default now()
);
create index on public.quiz_attempts (user_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lesson_id text not null references public.lessons on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.notes (user_id, lesson_id);

create table public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  lesson_id text not null references public.lessons on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.lesson_questions (lesson_id);

-- ===== Funções =====
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- Cria o perfil quando a pessoa se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, company)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          new.raw_user_meta_data->>'company');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Segurança (RLS) =====
alter table public.tracks enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.module_lessons enable row level security;
alter table public.chapters enable row level security;
alter table public.materials enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.news enable row level security;
alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.notes enable row level security;
alter table public.lesson_questions enable row level security;

-- Catálogo: qualquer aluno logado lê; só admin escreve
create policy "ler trilhas" on public.tracks for select to authenticated using (published or (select public.is_admin()));
create policy "admin trilhas" on public.tracks for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "ler modulos" on public.modules for select to authenticated using (true);
create policy "admin modulos" on public.modules for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "ler aulas" on public.lessons for select to authenticated using (true);
create policy "admin aulas" on public.lessons for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "ler modulo_aulas" on public.module_lessons for select to authenticated using (true);
create policy "admin modulo_aulas" on public.module_lessons for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "ler capitulos" on public.chapters for select to authenticated using (true);
create policy "admin capitulos" on public.chapters for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "ler materiais" on public.materials for select to authenticated using (true);
create policy "admin materiais" on public.materials for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "ler quiz" on public.quiz_questions for select to authenticated using (true);
create policy "admin quiz" on public.quiz_questions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "ler novidades" on public.news for select to authenticated using (published or (select public.is_admin()));
create policy "admin novidades" on public.news for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Perfil: cada um vê e edita o seu; admin vê todos. is_admin não é editável pelo aluno.
create policy "ver perfil" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "editar perfil" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (full_name, company, role_track, experience, last_track_id, last_lesson_id) on public.profiles to authenticated;

create policy "meu progresso" on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "marcar aula" on public.lesson_progress for insert to authenticated with check (user_id = (select auth.uid()));
create policy "desmarcar aula" on public.lesson_progress for delete to authenticated using (user_id = (select auth.uid()));

create policy "meus quizzes" on public.quiz_attempts for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Sem policy de insert: a tentativa só entra por submit_quiz, que corrige no banco (nota não é forjável).

-- Gabarito: o aluno lê pergunta e opções, mas não "correct" nem "explanation".
revoke select on public.quiz_questions from authenticated;
grant select (id, module_id, position, question, options) on public.quiz_questions to authenticated;

create or replace function public.submit_quiz(p_module uuid, p_answers int[])
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_correct int[]; v_expl text[]; v_score int := 0; v_total int;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select array_agg(correct order by position), array_agg(coalesce(explanation, '') order by position)
    into v_correct, v_expl from public.quiz_questions where module_id = p_module;
  v_total := coalesce(array_length(v_correct, 1), 0);
  if v_total = 0 then return null; end if;
  for i in 1..v_total loop
    if p_answers[i] = v_correct[i] then v_score := v_score + 1; end if;
  end loop;
  insert into public.quiz_attempts (user_id, module_id, score, total) values (auth.uid(), p_module, v_score, v_total);
  return jsonb_build_object('score', v_score, 'total', v_total, 'correct', to_jsonb(v_correct), 'explanations', to_jsonb(v_expl));
end $$;
revoke execute on function public.submit_quiz(uuid, int[]) from public, anon;
grant execute on function public.submit_quiz(uuid, int[]) to authenticated;

-- Para o painel de admin ler o gabarito completo.
create or replace function public.admin_quiz_questions(p_module uuid)
returns setof public.quiz_questions language sql stable security definer set search_path = ''
as $$ select * from public.quiz_questions where module_id = p_module and public.is_admin() order by position $$;
revoke execute on function public.admin_quiz_questions(uuid) from public, anon;
grant execute on function public.admin_quiz_questions(uuid) to authenticated;

create policy "minhas anotacoes" on public.notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "ver duvidas" on public.lesson_questions for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "perguntar" on public.lesson_questions for insert to authenticated with check (user_id = (select auth.uid()) and answer is null);
create policy "responder duvida" on public.lesson_questions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
