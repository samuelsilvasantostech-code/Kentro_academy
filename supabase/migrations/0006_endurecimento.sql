-- Kentro Academy: endurecimento final antes do lançamento. Aditiva: sem drop de tabela, coluna, policy ou constraint.

-- ===== 1. submit_quiz: valida o vetor de respostas e freia a descoberta do gabarito por tentativa =====
-- Parte da definição da 0004; nota e formato de retorno não mudam.
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
  if p_answers is null or cardinality(p_answers) <> v_total or array_ndims(p_answers) <> 1
     or array_position(p_answers, null) is not null then
    raise exception 'invalid_answers' using errcode = '22023';
  end if;
  -- Freio: no máximo uma tentativa a cada 20 s por aluno e módulo.
  if exists (select 1 from public.quiz_attempts
              where user_id = auth.uid() and module_id = p_module and created_at > now() - interval '20 seconds') then
    raise exception 'too_fast' using errcode = '54000';
  end if;
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

-- ===== 2. handle_new_user: trunca nome e empresa para não estourar as constraints de 120 caracteres =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, company)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
          left(new.raw_user_meta_data->>'company', 120));
  return new;
end $$;

-- ===== 3. Funções novas no schema public não nascem executáveis por public/anon =====
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
