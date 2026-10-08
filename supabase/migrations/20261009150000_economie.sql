-- Economia, pasul 3: Vitrina, misiunile zilei, premiile săptămânii și Cupa de
-- duminică. Seturile din colecție n-au tabel: le dă funcția `portofel` prin
-- `recompensa` (cheia 'set:<id>'), o singură dată. Zilele și săptămânile sunt pe ora
-- României.

-- ---------- Vitrina: exact mașina care îți lipsește ----------
create or replace function public.cumpara_masina(p_jucator uuid, p_masina text, p_raritate int, p_pret int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
begin
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'portofel'); end if;
  if exists (select 1 from public.garaje where jucator = p_jucator and masina = p_masina) then
    return json_build_object('eroare', 'o ai');
  end if;
  if p.mil < p_pret then return json_build_object('eroare', 'bani'); end if;
  update public.portofele set mil = mil - p_pret, actualizat = now() where jucator = p_jucator;
  insert into public.garaje (jucator, masina, raritate) values (p_jucator, p_masina, p_raritate);
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, -p_pret, 'vitrina', json_build_object('masina', p_masina)::jsonb);
  return json_build_object('mil', p.mil - p_pret);
end;
$$;

-- ---------- misiunile zilei: ce s-a jucat azi ----------
alter table public.partide add column timp_ms integer;
create index partide_terminat on public.partide (joc, cat, terminat) where scor is not null;

create or replace function public.misiuni_progres(p_jucator uuid, p_data date)
returns json
language sql stable security definer set search_path = ''
as $$
  with p as (
    select joc, scor from public.partide
    where jucator = p_jucator and scor is not null and (terminat at time zone 'Europe/Bucharest')::date = p_data
  ), d as (
    select * from public.dueluri
    where rapid and (a = p_jucator or b = p_jucator) and (creat at time zone 'Europe/Bucharest')::date >= p_data - 1
  )
  select json_build_object(
    'ssj', coalesce((select max(scor) from p where joc = 'sus-sau-jos'), 0),
    'ord', coalesce((select max(scor) from p where joc = 'ordine'), 0),
    'partide', (select count(*) from p),
    'lazi', (select count(*) from public.miscari where jucator = p_jucator and motiv in ('lada', 'lada gratis')
              and (creat at time zone 'Europe/Bucharest')::date = p_data),
    'cursa', (select count(*) from public.zi_rezultate where jucator = p_jucator and data = p_data),
    'rapid', (select count(*) from d where (creat at time zone 'Europe/Bucharest')::date = p_data and (
               (a = p_jucator and stare in ('deschis', 'acceptat', 'incheiat', 'expirat'))
               or (b = p_jucator and stare = 'incheiat'))),
    'castig', (select count(*) from d where castigator = p_jucator and (incheiat at time zone 'Europe/Bucharest')::date = p_data)
  );
$$;

-- ---------- premiile săptămânii ----------
-- O plată (a unei săptămâni, a unei cupe) se face o singură dată.
create table public.premii_platite (
  cheie text primary key,
  detalii jsonb,
  creat timestamptz not null default now()
);
alter table public.premii_platite enable row level security;
grant select, insert, update, delete on public.premii_platite to service_role;

-- Clasamentul unei săptămâni (de luni până duminică) într-un joc și o categorie:
-- cea mai bună partidă cu cronometru a fiecăruia.
create or replace function public.clasament_saptamana(p_joc text, p_cat text, p_luni date, p_limita int default 20)
returns json
language sql stable security definer set search_path = ''
as $$
  with b as (
    select distinct on (jucator) jucator, scor, timp_ms, terminat
    from public.partide
    where joc = p_joc and cat = p_cat and scor is not null and scor > 0 and timp_ms is not null
      and (terminat at time zone 'Europe/Bucharest')::date between p_luni and p_luni + 6
    order by jucator, scor desc, timp_ms, terminat
  ), r as (
    select b.*, j.nume, row_number() over (order by b.scor desc, b.timp_ms, b.terminat) as loc
    from b join public.jucatori j on j.id = b.jucator
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
revoke all on function public.clasament_saptamana(text, text, date, int) from public;
grant execute on function public.clasament_saptamana(text, text, date, int) to anon, authenticated, service_role;

-- Plata unei săptămâni încheiate: premiile la primii, dacă au jucat destui.
create or replace function public.plateste_saptamana(p_joc text, p_cat text, p_luni date, p_premii int[], p_minim int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_cheie text := 'saptamana:' || p_joc || ':' || p_luni;
  x record;
  n int;
  platiti json[] := '{}';
begin
  if p_luni + 7 > (now() at time zone 'Europe/Bucharest')::date then return json_build_object('eroare', 'in curs'); end if;
  insert into public.premii_platite (cheie) values (v_cheie) on conflict do nothing;
  if not found then return json_build_object('deja', true); end if;
  select count(distinct jucator) into n from public.partide
  where joc = p_joc and cat = p_cat and scor is not null and scor > 0 and timp_ms is not null
    and (terminat at time zone 'Europe/Bucharest')::date between p_luni and p_luni + 6;
  if n >= p_minim then
    for x in
      select jucator, row_number() over (order by scor desc, timp_ms, terminat) as loc from (
        select distinct on (jucator) jucator, scor, timp_ms, terminat from public.partide
        where joc = p_joc and cat = p_cat and scor is not null and scor > 0 and timp_ms is not null
          and (terminat at time zone 'Europe/Bucharest')::date between p_luni and p_luni + 6
        order by jucator, scor desc, timp_ms, terminat
      ) b order by loc limit array_length(p_premii, 1)
    loop
      perform public.recompensa(x.jucator, p_premii[x.loc::int], 0, 'premiul saptamanii', v_cheie,
        json_build_object('joc', p_joc, 'cat', p_cat, 'luni', p_luni, 'loc', x.loc)::jsonb);
      platiti := platiti || json_build_object('loc', x.loc, 'mil', p_premii[x.loc::int]);
    end loop;
  end if;
  update public.premii_platite set detalii = json_build_object('jucatori', n, 'platiti', platiti)::jsonb where cheie = v_cheie;
  return json_build_object('jucatori', n, 'platiti', platiti);
end;
$$;

-- ---------- Cupa de duminică ----------
-- Zile de cupă în plus, pe lângă duminici (le pune administratorul).
create table public.cupe_extra (data date primary key);
alter table public.cupe_extra enable row level security;
grant select, insert, update, delete on public.cupe_extra to service_role;

create table public.cupa_inscrieri (
  data date not null,
  jucator uuid not null references public.jucatori (id) on delete cascade,
  folosite smallint not null default 0,
  deschisa boolean not null default false,
  timp_ms integer,
  apasari integer[],
  tur integer[],
  creat timestamptz not null default now(),
  actualizat timestamptz not null default now(),
  primary key (data, jucator)
);
create index cupa_clasament on public.cupa_inscrieri (data, timp_ms, actualizat);
alter table public.cupa_inscrieri enable row level security;
grant select, insert, update, delete on public.cupa_inscrieri to service_role;

-- Intrarea: plătești o dată pe cupă și primești încercările.
create or replace function public.cupa_intra(p_jucator uuid, p_data date, p_intrare int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
begin
  if exists (select 1 from public.cupa_inscrieri where data = p_data and jucator = p_jucator) then
    return json_build_object('eroare', 'inscris');
  end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found or p.mil < p_intrare then return json_build_object('eroare', 'bani'); end if;
  update public.portofele set mil = mil - p_intrare, actualizat = now() where jucator = p_jucator;
  insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, -p_intrare, 'intrare cupa', json_build_object('data', p_data)::jsonb);
  insert into public.cupa_inscrieri (data, jucator) values (p_data, p_jucator);
  return json_build_object('mil', p.mil - p_intrare);
end;
$$;

-- O încercare începe: se consumă de la start (o cursă părăsită e o încercare pierdută).
create or replace function public.cupa_porneste(p_jucator uuid, p_data date, p_max int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  i public.cupa_inscrieri;
begin
  select * into i from public.cupa_inscrieri where data = p_data and jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'neinscris'); end if;
  if i.folosite >= p_max then return json_build_object('eroare', 'fara incercari'); end if;
  update public.cupa_inscrieri set folosite = folosite + 1, deschisa = true, actualizat = now()
  where data = p_data and jucator = p_jucator;
  return json_build_object('folosite', i.folosite + 1);
end;
$$;

-- Cursa încercării deschise (timpul l-a socotit serverul din apăsări). Rămâne cel mai bun.
create or replace function public.cupa_cursa(p_jucator uuid, p_data date, p_timp int, p_apasari int[], p_tur int[])
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  i public.cupa_inscrieri;
  record boolean;
begin
  select * into i from public.cupa_inscrieri where data = p_data and jucator = p_jucator for update;
  if not found or not i.deschisa then return json_build_object('eroare', 'nicio incercare'); end if;
  record := p_timp is not null and (i.timp_ms is null or p_timp < i.timp_ms);
  update public.cupa_inscrieri set deschisa = false, actualizat = now(),
    timp_ms = case when record then p_timp else timp_ms end,
    apasari = case when record then p_apasari else apasari end,
    tur = case when record then p_tur else tur end
  where data = p_data and jucator = p_jucator;
  return json_build_object('record', record, 'cel_mai_bun', case when record then p_timp else i.timp_ms end);
end;
$$;

-- Clasamentul unei cupe: înscrișii, potul și primii.
create or replace function public.clasament_cupa(p_data date, p_limita int default 20)
returns json
language sql stable security definer set search_path = ''
as $$
  with i as (select * from public.cupa_inscrieri where data = p_data),
  r as (
    select i.jucator, j.nume, i.timp_ms, row_number() over (order by i.timp_ms, i.actualizat) as loc
    from i join public.jucatori j on j.id = i.jucator where i.timp_ms is not null
  )
  select json_build_object(
    'data', p_data,
    'inscrisi', (select count(*) from i),
    'total', (select count(*) from r),
    'top', coalesce((
      select json_agg(json_build_object('loc', loc, 'nume', nume, 'timp', timp_ms, 'eu', jucator = (select auth.uid())) order by loc)
      from r where loc <= least(greatest(p_limita, 1), 50)
    ), '[]'::json),
    'eu', (select json_build_object('loc', loc, 'timp', timp_ms) from r where jucator = (select auth.uid())),
    'platit', exists (select 1 from public.premii_platite where cheie = 'cupa:' || p_data)
  );
$$;
-- ultima cupă cu înscriși (pentru fereastra Clasament)
create or replace function public.ultima_cupa()
returns date
language sql stable security definer set search_path = ''
as $$ select max(data) from public.cupa_inscrieri $$;
revoke all on function public.clasament_cupa(date, int) from public;
revoke all on function public.ultima_cupa() from public;
grant execute on function public.clasament_cupa(date, int) to anon, authenticated, service_role;
grant execute on function public.ultima_cupa() to anon, authenticated, service_role;

-- Plata unei cupe încheiate: potul (intrările minus comisionul) la primii trei; sub
-- `p_minim` înscriși, fiecare își ia intrarea înapoi.
create or replace function public.plateste_cupa(p_data date, p_impartire int[], p_minim int, p_intrare int, p_comision numeric)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_cheie text := 'cupa:' || p_data;
  n int;
  pot int;
  x record;
  suma int;
  platiti json[] := '{}';
begin
  if p_data >= (now() at time zone 'Europe/Bucharest')::date then return json_build_object('eroare', 'in curs'); end if;
  insert into public.premii_platite (cheie) values (v_cheie) on conflict do nothing;
  if not found then return json_build_object('deja', true); end if;
  select count(*) into n from public.cupa_inscrieri where data = p_data;
  pot := floor(n * p_intrare * (1 - p_comision))::int;
  if n < p_minim then
    for x in select jucator from public.cupa_inscrieri where data = p_data loop
      perform public.recompensa(x.jucator, p_intrare, 0, 'cupa anulata', v_cheie, json_build_object('data', p_data)::jsonb);
    end loop;
  else
    for x in
      select jucator, row_number() over (order by timp_ms, actualizat) as loc
      from public.cupa_inscrieri where data = p_data and timp_ms is not null
      order by loc limit array_length(p_impartire, 1)
    loop
      suma := floor(pot * p_impartire[x.loc::int] / 100.0)::int;
      perform public.recompensa(x.jucator, suma, 0, 'premiu cupa', v_cheie, json_build_object('data', p_data, 'loc', x.loc)::jsonb);
      platiti := platiti || json_build_object('loc', x.loc, 'mil', suma);
    end loop;
  end if;
  update public.premii_platite set detalii = json_build_object('inscrisi', n, 'pot', pot, 'platiti', platiti)::jsonb where cheie = v_cheie;
  return json_build_object('inscrisi', n, 'pot', pot, 'platiti', platiti);
end;
$$;

revoke all on function public.cumpara_masina(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.misiuni_progres(uuid, date) from public, anon, authenticated;
revoke all on function public.plateste_saptamana(text, text, date, int[], int) from public, anon, authenticated;
revoke all on function public.cupa_intra(uuid, date, int) from public, anon, authenticated;
revoke all on function public.cupa_porneste(uuid, date, int) from public, anon, authenticated;
revoke all on function public.cupa_cursa(uuid, date, int, int[], int[]) from public, anon, authenticated;
revoke all on function public.plateste_cupa(date, int[], int, int, numeric) from public, anon, authenticated;
grant execute on function public.cumpara_masina(uuid, text, int, int) to service_role;
grant execute on function public.misiuni_progres(uuid, date) to service_role;
grant execute on function public.plateste_saptamana(text, text, date, int[], int) to service_role;
grant execute on function public.cupa_intra(uuid, date, int) to service_role;
grant execute on function public.cupa_porneste(uuid, date, int) to service_role;
grant execute on function public.cupa_cursa(uuid, date, int, int[], int[]) to service_role;
grant execute on function public.plateste_cupa(date, int[], int, int, numeric) to service_role;
