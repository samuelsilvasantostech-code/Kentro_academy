-- Kentro Academy: certificado permanente + endurecimento de acesso. Aditiva: sem drop de tabela, coluna ou policy.

-- ===== 1. Certificado conquistado é para sempre =====
-- Uma linha por (aluno, trilha), criada na primeira vez em que track_completion diz "concluída".
-- Conteúdo publicado depois não tira o certificado. issued_at = data da primeira conclusão (completed_at de track_completion).
create table public.track_certificates (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track_id text not null references public.tracks (id) on delete cascade,
  issued_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
create index track_certificates_track_idx on public.track_certificates (track_id);
alter table public.track_certificates enable row level security;

create policy "meus certificados" on public.track_certificates for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- track_completion é security invoker: roda como o aluno, então só enxerga o progresso dele.
-- Sem update/delete para o aluno.
create policy "emitir certificado" on public.track_certificates for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and issued_at <= now()
    and exists (
      select 1 from public.track_completion(track_certificates.track_id) c
       where c.completed and c.completed_at = track_certificates.issued_at
    )
  );
revoke all on public.track_certificates from public, anon, authenticated;
grant select on public.track_certificates to authenticated;
grant insert (track_id, issued_at) on public.track_certificates to authenticated;

-- ===== 2. anon não tem policy em nada, então não deve ter grant =====
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- ===== 3. Vínculo aula-módulo some para o aluno se a trilha é rascunho =====
-- (a aula em si continua legível se publicada; ela pode estar em outra trilha publicada)
create policy "modulo_aulas de trilha publicada" on public.module_lessons as restrictive for select to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.modules m join public.tracks t on t.id = m.track_id
     where m.id = module_lessons.module_id and t.published));
