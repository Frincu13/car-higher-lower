-- Tuning pe piese: Anvelope, Ușurare, Motor, Cutie, câte 0-5 niveluri. Cele patru
-- stau în același `nivel` de până acum, ca cifre în baza 6 (a + 6u + 36m + 216c),
-- deci duelurile, cursa live și echipa le poartă fără alte coloane. Modelul cursei
-- (drag-model.js) le desface.

-- Nivelurile vechi (0-5, fiecare 1,2% pe tot sfertul de milă) trec pe Anvelope,
-- Ușurare și Motor deodată: cam aceeași viteză (nivelul 5 vechi: 6%, acum 6,2%).
update public.garaje set nivel = nivel * 43 where nivel between 1 and 5;
update public.dueluri set nivel_a = nivel_a * 43 where nivel_a between 1 and 5 and stare in ('pregatit', 'deschis', 'acceptat');
update public.dueluri set nivel_b = nivel_b * 43 where nivel_b between 1 and 5 and stare in ('pregatit', 'deschis', 'acceptat');

-- O piesă (0 Anvelope, 1 Ușurare, 2 Motor, 3 Cutie) urcă un nivel, pe puncte de
-- raritatea mașinii; costul îl socotește funcția de pe server din nivelul piesei.
create or replace function public.tuneaza_piesa(p_jucator uuid, p_masina text, p_piesa int, p_raritate int, p_cost int)
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
  if p_piesa not between 0 and 3 or p_raritate not between 0 and 4 or p_cost < 1 then return json_build_object('eroare', 'tuning'); end if;
  pas := power(6, p_piesa)::int;
  select * into g from public.garaje where jucator = p_jucator and masina = p_masina for update;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if g.blocat then return json_build_object('eroare', 'blocata'); end if;
  acum := (g.nivel / pas) % 6;
  if acum >= 5 then return json_build_object('eroare', 'maxim'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found or p.puncte[p_raritate + 1] < p_cost then return json_build_object('eroare', 'puncte'); end if;
  update public.portofele set puncte[p_raritate + 1] = puncte[p_raritate + 1] - p_cost, actualizat = now() where jucator = p_jucator;
  update public.garaje set nivel = nivel + pas where jucator = p_jucator and masina = p_masina;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, 0, 'tuning', json_build_object('masina', p_masina, 'piesa', p_piesa, 'nivel', acum + 1, 'puncte', p_cost)::jsonb);
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('nivel', g.nivel + pas, 'mil', p.mil, 'puncte', p.puncte);
end;
$$;
revoke all on function public.tuneaza_piesa(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.tuneaza_piesa(uuid, text, int, int, int) to service_role;

-- Profilul: „Mecanic" = o mașină cu o piesă la nivelul 5
create or replace function public.profil_meu()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with eu as (select auth.uid() as id)
  select case when (select id from eu) is null then null else json_build_object(
    'nume', (select nume from public.jucatori where id = (select id from eu)),
    'din', (select created_at from auth.users where id = (select id from eu)),
    'portofel', (select json_build_object('mil', mil, 'serie', serie, 'ultima_zi', ultima_zi) from public.portofele where jucator = (select id from eu)),
    'garaj', (select json_build_object('masini', count(*), 'legendare', count(*) filter (where raritate = 4), 'exotice', count(*) filter (where raritate = 3), 'nivel5', count(*) filter (where nivel % 6 = 5 or (nivel / 6) % 6 = 5 or (nivel / 36) % 6 = 5 or (nivel / 216) % 6 = 5)) from public.garaje where jucator = (select id from eu)),
    'seturi', (select count(*) from public.miscari where jucator = (select id from eu) and motiv = 'set complet'),
    'misiuni', (select count(*) from public.miscari where jucator = (select id from eu) and motiv = 'misiune'),
    'lazi', (select count(*) from public.miscari where jucator = (select id from eu) and motiv in ('lada', 'lada gratis')),
    'general', (select coalesce(json_agg(json_build_object('joc', joc, 'cat', cat, 'scor', scor, 'timp', timp_ms)), '[]'::json) from public.scoruri_general where jucator = (select id from eu)),
    'provocari', (select count(*) from public.scoruri_zi where jucator = (select id from eu)) + (select count(*) from public.zi_rezultate where jucator = (select id from eu)),
    'zile', (select count(distinct d) from (select data as d from public.scoruri_zi where jucator = (select id from eu) union select data from public.zi_rezultate where jucator = (select id from eu)) z),
    'cursa_zilei', (select min(timp_ms) from public.zi_rezultate where jucator = (select id from eu)),
    'dueluri', (select json_build_object(
        'jucate', count(*) filter (where stare = 'incheiat'),
        'castigate', count(*) filter (where stare = 'incheiat' and castigator = (select id from eu)),
        'acte', count(*) filter (where stare = 'incheiat' and tip = 'acte' and castigator = (select id from eu)))
      from public.dueluri where a = (select id from eu) or b = (select id from eu)),
    'podium_saptamana', (select count(*) from public.miscari where jucator = (select id from eu) and motiv = 'premiul saptamanii'),
    'podium_cupa', (select count(*) from public.miscari where jucator = (select id from eu) and motiv = 'premiu cupa'),
    'recorduri', (select count(*) from public.recorduri where jucator = (select id from eu)),
    'stat', (select coalesce(json_object_agg(cheie, n), '{}'::json) from public.statistici where jucator = (select id from eu))
  ) end;
$$;
