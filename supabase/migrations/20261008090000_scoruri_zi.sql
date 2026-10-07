-- Clasamentul Provocării zilei din Sus sau jos și În ordine.
-- Clientul trimite doar răspunsurile; funcția trimite-scor reface partida zilei cu
-- același model ca jocul și numără singură scorul. Răspunsurile nu se văd public
-- (ar da răspunsurile zilei); restul coloanelor da.

create table public.scoruri_zi (
  jucator uuid not null references public.jucatori (id) on delete cascade,
  joc text not null check (joc in ('sus-sau-jos', 'ordine')),
  data date not null,
  scor integer not null check (scor between 0 and 10000),
  timp_ms integer not null check (timp_ms between 0 and 86400000),
  raspunsuri jsonb not null,
  creat timestamptz not null default now(),
  primary key (jucator, joc, data)
);
create index scoruri_zi_clasament on public.scoruri_zi (joc, data, scor desc, timp_ms, creat);

alter table public.scoruri_zi enable row level security;
create policy "scoruri_zi: citire publica" on public.scoruri_zi
  for select to anon, authenticated using (true);
grant select (jucator, joc, data, scor, timp_ms, creat) on public.scoruri_zi to anon, authenticated;
grant select, insert, update, delete on public.scoruri_zi to service_role;

-- Clasamentul unei zile într-un joc: scorul mai mare întâi, la egalitate timpul mai mic.
create or replace function public.clasament_joc(p_joc text, p_data date, p_limita int default 10)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (
    select s.jucator, j.nume, s.scor, s.timp_ms,
           row_number() over (order by s.scor desc, s.timp_ms, s.creat) as loc
    from public.scoruri_zi s
    join public.jucatori j on j.id = s.jucator
    where s.joc = p_joc and s.data = p_data
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
revoke all on function public.clasament_joc(text, date, int) from public;
grant execute on function public.clasament_joc(text, date, int) to anon, authenticated, service_role;
