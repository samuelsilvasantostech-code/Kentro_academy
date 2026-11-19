-- Ajustes apontados pelos advisors do Supabase depois da 0001.

-- handle_new_user só roda pelo gatilho; is_admin só para quem está logado (as policies usam).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Índices das chaves estrangeiras
create index on public.lesson_progress (lesson_id);
create index on public.lesson_questions (user_id);
create index on public.notes (lesson_id);
create index on public.profiles (role_track);
create index on public.quiz_attempts (module_id);

-- Pendente (só desempenho, não aplicado): trocar as policies "admin ... for all" por
-- insert/update/delete, para cada leitura avaliar uma policy só. Envolve drop policy.
