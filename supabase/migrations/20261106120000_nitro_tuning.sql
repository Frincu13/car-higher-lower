-- Nitro, a cincea piesă de tuning (pentru Cursă): a cincea cifră în baza 6 a nivelului
-- (nivel = anvelope + 6 ușurare + 36 motor + 216 cutie + 1296 nitro). Se plătește cu mil.,
-- ca Motorul, deci trece prin tuneaza_piesa_mil; tuneaza_piesa (pe puncte) rămâne la 0-3.
create or replace function public.tuneaza_piesa_mil(p_jucator uuid, p_exemplar bigint, p_piesa integer, p_cost integer)
returns json language plpgsql security definer set search_path = '' as $$
declare
  p public.portofele;
  e public.exemplare;
  pas int;
  acum int;
begin
  if p_piesa not between 0 and 4 or p_cost < 1 then return json_build_object('eroare', 'tuning'); end if;
  pas := power(6, p_piesa)::int;
  select * into e from public.exemplare where id = p_exemplar and jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if e.blocat then return json_build_object('eroare', 'blocata'); end if;
  acum := (e.nivel / pas) % 6;
  if acum >= 5 then return json_build_object('eroare', 'maxim'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found or p.mil < p_cost then return json_build_object('eroare', 'bani'); end if;
  update public.portofele set mil = mil - p_cost, actualizat = now() where jucator = p_jucator;
  update public.exemplare set nivel = nivel + pas where id = e.id;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, -p_cost, 'tuning', json_build_object('masina', e.masina, 'exemplar', e.id, 'piesa', p_piesa, 'nivel', acum + 1)::jsonb);
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('exemplar', e.id, 'nivel', e.nivel + pas, 'mil', p.mil, 'puncte', p.puncte);
end;
$$;
