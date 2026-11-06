-- Cursa devine jocul principal. Partidele de Cursă (bani după loc, misiuni), tururile lansate
-- refăcute de server din apăsări (Cupa de duminică, Turul săptămânii pe clase, camerele) și
-- progresul misiunilor noi.

alter table public.partide drop constraint if exists partide_joc_check;
alter table public.partide add constraint partide_joc_check check (joc = any (array['sus-sau-jos', 'ordine', 'carti', 'geaman', 'cursa']));

create table public.cursa_tururi (
  id bigint generated always as identity primary key,
  jucator uuid not null references public.jucatori (id) on delete cascade,
  tip text not null check (tip in ('cupa', 'sapt', 'camera')),
  cheie text not null,
  masina text not null,
  nivel integer not null default 0 check (nivel >= 0),
  clasa text not null check (clasa in ('S', 'A', 'B', 'C', 'D')),
  timp_ms integer not null check (timp_ms > 0),
  intrari jsonb not null,
  creat timestamptz not null default now()
);
create index cursa_tururi_clasament on public.cursa_tururi (tip, cheie, clasa, timp_ms);
create index cursa_tururi_jucator on public.cursa_tururi (jucator, creat desc);
alter table public.cursa_tururi enable row level security;
revoke all on public.cursa_tururi from anon, authenticated;
grant select, insert, update, delete on public.cursa_tururi to service_role;

-- misiunile: curse terminate, podiumuri și cele mai multe frânări perfecte într-o cursă;
-- cursele nu intră la „partide cu cronometru”
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
    'partide', (select count(*) from p where joc not in ('carti', 'geaman', 'cursa')),
    'carti', (select count(*) from p where joc = 'carti'),
    'cartiC', (select count(*) from p where joc = 'carti' and (date->>'castigat')::boolean),
    'geaman', (select count(*) from p where joc = 'geaman'),
    'geamanC', (select count(*) from p where joc = 'geaman' and (date->>'castigat')::boolean),
    'prov', (select count(*) from public.scoruri_zi where jucator = p_jucator and data = p_data)
          + (select count(*) from public.zi_rezultate where jucator = p_jucator and data = p_data),
    'lazi', (select count(*) from public.miscari where jucator = p_jucator and motiv in ('lada', 'lada gratis')
              and (creat at time zone 'Europe/Bucharest')::date = p_data),
    'cursa', (select count(*) from public.zi_rezultate where jucator = p_jucator and data = p_data),
    'rapid', (select count(*) from d where (creat at time zone 'Europe/Bucharest')::date = p_data and (
               (a = p_jucator and stare in ('deschis', 'acceptat', 'incheiat', 'expirat'))
               or (b = p_jucator and stare = 'incheiat'))),
    'castig', (select count(*) from d where castigator = p_jucator and (incheiat at time zone 'Europe/Bucharest')::date = p_data),
    'curse', (select count(*) from p where joc = 'cursa'),
    'podium', (select count(*) from p where joc = 'cursa' and (date->>'loc')::int <= 3),
    'perfecte', coalesce((select max((date->>'perfecte')::int) from p where joc = 'cursa'), 0)
  );
$function$;

-- Camerele Cursei: un cod, până la 10 prieteni; fiecare face tururi până la `pana`, contează
-- cel mai bun (tururile stau în cursa_tururi, tip 'camera', cheie = codul). `mod`: aceeași
-- mașină pentru toți (stoc) sau fiecare cu mașina lui. Tot aici se adună pentru cursa live.
create table public.cursa_camere (
  id uuid primary key default gen_random_uuid(),
  cod text not null unique check (cod ~ '^[A-Z0-9]{5}$'),
  gazda uuid not null references public.jucatori (id) on delete cascade,
  mod text not null check (mod in ('aceeasi', 'a mea')),
  masina text,
  pana timestamptz not null,
  creat timestamptz not null default now()
);
create index cursa_camere_gazda on public.cursa_camere (gazda, creat desc);
alter table public.cursa_camere enable row level security;
revoke all on public.cursa_camere from anon, authenticated;
grant select, insert, update, delete on public.cursa_camere to service_role;
