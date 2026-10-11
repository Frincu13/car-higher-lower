-- Motorul se plătește în mil. (o piesă pe bani, ca banii să aibă și ei unde merge
-- în garaj); celelalte trei rămân pe puncte de raritate. Costul îl socotește funcția
-- de pe server (economie.js, TUNING.mil).
create or replace function public.tuneaza_piesa_mil(p_jucator uuid, p_masina text, p_piesa int, p_cost int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.portofele;
  g public.garaje;
  pas int;
  acum int;
begin
  if p_piesa not between 0 and 3 or p_cost < 1 then return json_build_object('eroare', 'tuning'); end if;
  pas := power(6, p_piesa)::int;
  select * into g from public.garaje where jucator = p_jucator and masina = p_masina for update;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if g.blocat then return json_build_object('eroare', 'blocata'); end if;
  acum := (g.nivel / pas) % 6;
  if acum >= 5 then return json_build_object('eroare', 'maxim'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found or p.mil < p_cost then return json_build_object('eroare', 'bani'); end if;
  update public.portofele set mil = mil - p_cost, actualizat = now() where jucator = p_jucator;
  update public.garaje set nivel = nivel + pas where jucator = p_jucator and masina = p_masina;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, -p_cost, 'tuning', json_build_object('masina', p_masina, 'piesa', p_piesa, 'nivel', acum + 1)::jsonb);
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('nivel', g.nivel + pas, 'mil', p.mil, 'puncte', p.puncte);
end;
$$;
revoke all on function public.tuneaza_piesa_mil(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.tuneaza_piesa_mil(uuid, text, int, int) to service_role;
