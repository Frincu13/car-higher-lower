-- Geamănul contra botului, cu bani: partidele lui stau în `partide` (joc 'geaman').
-- Misiunea „partide cu cronometru" nu le numără (n-au cronometru), ca la Duel de cărți.
alter table public.partide drop constraint if exists partide_joc_check;
alter table public.partide add constraint partide_joc_check check (joc = any (array['sus-sau-jos', 'ordine', 'carti', 'geaman']));

CREATE OR REPLACE FUNCTION public.misiuni_progres(p_jucator uuid, p_data date)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with p as (
    select joc, scor, date from public.partide
    where jucator = p_jucator and scor is not null and (terminat at time zone 'Europe/Bucharest')::date = p_data
  ), d as (
    select * from public.dueluri
    where rapid and (a = p_jucator or b = p_jucator) and (creat at time zone 'Europe/Bucharest')::date >= p_data - 1
  )
  select json_build_object(
    'ssj', coalesce((select max(scor) from p where joc = 'sus-sau-jos'), 0),
    'ord', coalesce((select max(scor) from p where joc = 'ordine'), 0),
    'partide', (select count(*) from p where joc not in ('carti', 'geaman')),
    'carti', (select count(*) from p where joc = 'carti'),
    'cartiC', (select count(*) from p where joc = 'carti' and (date->>'castigat')::boolean),
    'lazi', (select count(*) from public.miscari where jucator = p_jucator and motiv in ('lada', 'lada gratis')
              and (creat at time zone 'Europe/Bucharest')::date = p_data),
    'cursa', (select count(*) from public.zi_rezultate where jucator = p_jucator and data = p_data),
    'rapid', (select count(*) from d where (creat at time zone 'Europe/Bucharest')::date = p_data and (
               (a = p_jucator and stare in ('deschis', 'acceptat', 'incheiat', 'expirat'))
               or (b = p_jucator and stare = 'incheiat'))),
    'castig', (select count(*) from d where castigator = p_jucator and (incheiat at time zone 'Europe/Bucharest')::date = p_data)
  );
$function$
;
