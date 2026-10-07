-- Clasamentul Cursei zilei din Startul.
-- Jucătorii au cont anonim (Supabase Auth) și un nume. Timpul nu se ia de la client:
-- funcția trimite-zi reface cursa din apăsări cu același model ca jocul și scrie
-- rezultatul cu cheia de server. Clienții pot doar citi.

create table public.jucatori (
  id uuid primary key references auth.users (id) on delete cascade,
  nume text not null check (char_length(nume) between 1 and 16),
  creat timestamptz not null default now(),
  actualizat timestamptz not null default now()
);

-- Cel mai bun timp al fiecăruia, pe zi. Apăsările rămân, ca oricine să poată
-- concura contra fantomei unui loc din clasament.
create table public.zi_rezultate (
  jucator uuid not null references public.jucatori (id) on delete cascade,
  data date not null,
  masina text not null,
  timp_ms integer not null check (timp_ms between 3000 and 60000),
  reactie_ms integer not null,
  apasari integer[] not null,
  tur integer[] not null default '{}',
  creat timestamptz not null default now(),
  primary key (jucator, data)
);
create index zi_rezultate_clasament on public.zi_rezultate (data, timp_ms, creat);

-- Fiecare trimitere, pentru limita de trimiteri pe minut. Nu se vede din afară.
create table public.zi_trimiteri (
  id bigint generated always as identity primary key,
  jucator uuid not null references public.jucatori (id) on delete cascade,
  creat timestamptz not null default now()
);
create index zi_trimiteri_jucator on public.zi_trimiteri (jucator, creat);

alter table public.jucatori enable row level security;
alter table public.zi_rezultate enable row level security;
alter table public.zi_trimiteri enable row level security;

-- Citire publică pentru clasament; nicio regulă de scriere: scrie doar serverul.
create policy "jucatori: citire publica" on public.jucatori
  for select to anon, authenticated using (true);
create policy "zi_rezultate: citire publica" on public.zi_rezultate
  for select to anon, authenticated using (true);
grant select on public.jucatori, public.zi_rezultate to anon, authenticated;
revoke all on public.zi_trimiteri from anon, authenticated;

-- Clasamentul unei zile: primii N, câți au concurat și locul tău.
create or replace function public.clasament_zi(p_data date, p_limita int default 10)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (
    select z.jucator, j.nume, z.timp_ms, z.masina,
           row_number() over (order by z.timp_ms, z.creat) as loc
    from public.zi_rezultate z
    join public.jucatori j on j.id = z.jucator
    where z.data = p_data
  )
  select json_build_object(
    'total', (select count(*) from r),
    'top', coalesce((
      select json_agg(json_build_object('loc', loc, 'nume', nume, 'timp', timp_ms, 'eu', jucator = (select auth.uid())) order by loc)
      from r where loc <= least(greatest(p_limita, 1), 50)
    ), '[]'::json),
    'eu', (select json_build_object('loc', loc, 'timp', timp_ms) from r where jucator = (select auth.uid()))
  );
$$;
revoke all on function public.clasament_zi(date, int) from public;
grant execute on function public.clasament_zi(date, int) to anon, authenticated;
