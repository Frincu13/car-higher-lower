-- Clasamentul general din Sus sau jos și În ordine: doar partidele cu cronometru,
-- cel mai bun scor al fiecăruia pe categorie, de oricând. Partida o pornește serverul
-- (dă seed-ul și ține ora de start), iar la final o reface din răspunsuri și verifică
-- pe ceasul lui că a încăput în timpul dat pe fiecare mașină.

create table public.partide (
  id uuid primary key default gen_random_uuid(),
  jucator uuid not null references public.jucatori (id) on delete cascade,
  joc text not null check (joc in ('sus-sau-jos', 'ordine')),
  cat text not null,
  seed integer not null,
  inceput timestamptz not null default now(),
  terminat timestamptz,
  scor integer
);
create index partide_jucator on public.partide (jucator, inceput desc);
alter table public.partide enable row level security;
grant select, insert, update, delete on public.partide to service_role;

create table public.scoruri_general (
  jucator uuid not null references public.jucatori (id) on delete cascade,
  joc text not null check (joc in ('sus-sau-jos', 'ordine')),
  cat text not null,
  scor integer not null check (scor between 0 and 10000),
  timp_ms integer not null check (timp_ms between 0 and 86400000),
  partida uuid not null,
  creat timestamptz not null default now(),
  primary key (jucator, joc, cat)
);
create index scoruri_general_clasament on public.scoruri_general (joc, cat, scor desc, timp_ms, creat);
alter table public.scoruri_general enable row level security;
create policy "scoruri_general: citire publica" on public.scoruri_general
  for select to anon, authenticated using (true);
grant select (jucator, joc, cat, scor, timp_ms, creat) on public.scoruri_general to anon, authenticated;
grant select, insert, update, delete on public.scoruri_general to service_role;

-- Clasamentul general al unei categorii: scorul mai mare întâi, la egalitate timpul mai mic.
create or replace function public.clasament_general(p_joc text, p_cat text, p_limita int default 20)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (
    select s.jucator, j.nume, s.scor, s.timp_ms,
           row_number() over (order by s.scor desc, s.timp_ms, s.creat) as loc
    from public.scoruri_general s
    join public.jucatori j on j.id = s.jucator
    where s.joc = p_joc and s.cat = p_cat
  )
  select json_build_object(
    'total', (select count(*) from r),
    'top', coalesce((
      select json_agg(json_build_object('loc', loc, 'nume', nume, 'scor', scor, 'timp', timp_ms, 'eu', jucator = (select auth.uid())) order by loc)
      from r where loc <= least(greatest(p_limita, 1), 50)
    ), '[]'::json),
    'eu', (select json_build_object('loc', loc, 'scor', scor, 'timp', timp_ms) from r where jucator = (select auth.uid()))
  );
$$;
revoke all on function public.clasament_general(text, text, int) from public;
grant execute on function public.clasament_general(text, text, int) to anon, authenticated, service_role;
