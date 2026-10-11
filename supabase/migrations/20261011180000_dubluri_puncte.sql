-- Dublurile: le alegi tu. O dublură nu se mai vinde singură la deschiderea lăzii:
-- stă în garaj (bucati > 1) până alegi între bani (vinde) și un punct de upgrade
-- de raritatea ei. Tuningul se plătește în puncte de aceeași raritate cu mașina.

-- Punctele de upgrade, pe raritate: [comune, rare, epice, exotice, legendare].
alter table public.portofele add column if not exists puncte integer[] not null default '{0,0,0,0,0}';

-- Până acum dublurile se vindeau pe loc, dar rămâneau numărate în `bucati`: le
-- scoatem, ca să nu se poată folosi a doua oară.
update public.garaje set bucati = 1 where bucati > 1;

-- Lada: plătește, pune mașina în garaj (o dublură crește `bucati`) și atât.
create or replace function public.deschide_lada(
  p_jucator uuid, p_lada text, p_pret int, p_gratis boolean,
  p_masina text, p_raritate int, p_valoare_dublura int
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.portofele;
  nr int;
begin
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'portofel'); end if;
  if p_gratis then
    if p.lazi_gratis < 1 then return json_build_object('eroare', 'fara lazi gratis'); end if;
    update public.portofele set lazi_gratis = lazi_gratis - 1, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, lazi, motiv, detalii) values (p_jucator, -1, 'lada gratis', json_build_object('lada', p_lada)::jsonb);
  else
    if p.mil < p_pret then return json_build_object('eroare', 'bani'); end if;
    update public.portofele set mil = mil - p_pret, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, -p_pret, 'lada', json_build_object('lada', p_lada)::jsonb);
  end if;
  insert into public.garaje (jucator, masina, raritate) values (p_jucator, p_masina, p_raritate)
  on conflict (jucator, masina) do update set bucati = public.garaje.bucati + 1
  returning bucati into nr;
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('noua', nr = 1, 'bucati', nr, 'mil', p.mil, 'lazi_gratis', p.lazi_gratis, 'puncte', p.puncte);
end;
$$;

-- O dublură: pe bani sau pe un punct de upgrade de raritatea ei. Valoarea și
-- raritatea le dă funcția de pe server (din economie.js), nu pagina.
create or replace function public.dublura_schimba(p_jucator uuid, p_masina text, p_alegere text, p_raritate int, p_valoare int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.garaje;
  p public.portofele;
begin
  if p_alegere not in ('vinde', 'puncte') or p_raritate not between 0 and 4 then return json_build_object('eroare', 'alegere'); end if;
  select * into g from public.garaje where jucator = p_jucator and masina = p_masina for update;
  if not found or g.bucati < 2 then return json_build_object('eroare', 'fara dublura'); end if;
  if g.blocat then return json_build_object('eroare', 'blocata'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'portofel'); end if;
  update public.garaje set bucati = bucati - 1 where jucator = p_jucator and masina = p_masina;
  if p_alegere = 'vinde' then
    update public.portofele set mil = mil + greatest(p_valoare, 0), actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, greatest(p_valoare, 0), 'dublura vanduta', json_build_object('masina', p_masina)::jsonb);
  else
    update public.portofele set puncte[p_raritate + 1] = puncte[p_raritate + 1] + 1, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, 0, 'dublura puncte', json_build_object('masina', p_masina, 'raritate', p_raritate)::jsonb);
  end if;
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('mil', p.mil, 'puncte', p.puncte, 'bucati', g.bucati - 1);
end;
$$;
revoke all on function public.dublura_schimba(uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function public.dublura_schimba(uuid, text, text, int, int) to service_role;

-- Tuningul pe puncte: nivelul următor costă p_cost puncte de raritatea mașinii.
create or replace function public.tuneaza_puncte(p_jucator uuid, p_masina text, p_raritate int, p_cost int, p_max int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.portofele;
  g public.garaje;
begin
  if p_raritate not between 0 and 4 or p_cost < 1 then return json_build_object('eroare', 'tuning'); end if;
  select * into g from public.garaje where jucator = p_jucator and masina = p_masina for update;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if g.blocat then return json_build_object('eroare', 'blocata'); end if;
  if g.nivel >= p_max then return json_build_object('eroare', 'maxim'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found or p.puncte[p_raritate + 1] < p_cost then return json_build_object('eroare', 'puncte'); end if;
  update public.portofele set puncte[p_raritate + 1] = puncte[p_raritate + 1] - p_cost, actualizat = now() where jucator = p_jucator;
  update public.garaje set nivel = nivel + 1 where jucator = p_jucator and masina = p_masina;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, 0, 'tuning', json_build_object('masina', p_masina, 'nivel', g.nivel + 1, 'puncte', p_cost)::jsonb);
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('nivel', g.nivel + 1, 'mil', p.mil, 'puncte', p.puncte);
end;
$$;
revoke all on function public.tuneaza_puncte(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.tuneaza_puncte(uuid, text, int, int, int) to service_role;
