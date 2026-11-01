-- Ce aduce și ține jucători: vizitele pe zile (ca să știm cine revine), garajul altora
-- (din clasament sau dintr-un link), notificarea „te-a depășit" (cel mult una pe zi) și
-- codurile de la evenimentele FRQ (un premiu, o singură dată pe cont).

-- ---------- vizitele: o zi pe rând, pentru revenirea după 1 și 7 zile ----------
create table public.vizite (
  jucator uuid not null references public.jucatori(id) on delete cascade,
  zi date not null,
  primul_la timestamptz not null default now(),
  primary key (jucator, zi)
);
alter table public.vizite enable row level security;
grant select, insert, update, delete on public.vizite to service_role;

-- ---------- notificările cu o limită pe zi ----------
-- un rând = jucătorul a primit deja azi o notificare de tipul ăsta
create table public.notificari_zi (
  jucator uuid not null references public.jucatori(id) on delete cascade,
  tip text not null,
  zi date not null,
  primary key (jucator, tip, zi)
);
alter table public.notificari_zi enable row level security;
grant select, insert, update, delete on public.notificari_zi to service_role;

-- Scorul garajului, notat; întoarce cine a fost depășit acum și n-a mai primit azi o
-- notificare de clasament (deci oricâți te-ar depăși, una pe zi).
drop function if exists public.noteaza_scor_garaj(uuid, integer, integer, date);
create function public.noteaza_scor_garaj(p_jucator uuid, p_scor integer, p_masini integer, p_luni date, p_zi date)
returns setof uuid
language plpgsql security definer set search_path = ''
as $$
declare
  vechi int;
begin
  select scor into vechi from public.scor_garaj where jucator = p_jucator;
  insert into public.scor_garaj_sapt (jucator, luni, start) values (p_jucator, p_luni, coalesce(vechi, 0))
  on conflict do nothing;
  insert into public.scor_garaj (jucator, scor, masini) values (p_jucator, p_scor, p_masini)
  on conflict (jucator) do update set scor = excluded.scor, masini = excluded.masini,
    actualizat = case when public.scor_garaj.scor <> excluded.scor then now() else public.scor_garaj.actualizat end;
  if vechi is not null and p_scor > vechi then
    return query
      with dep as (select g.jucator from public.scor_garaj g where g.jucator <> p_jucator and g.scor > vechi and g.scor < p_scor),
      noi as (insert into public.notificari_zi (jucator, tip, zi) select dep.jucator, 'clasament', p_zi from dep on conflict do nothing returning notificari_zi.jucator)
      select noi.jucator from noi;
  end if;
end;
$$;
revoke all on function public.noteaza_scor_garaj(uuid, integer, integer, date, date) from public, anon, authenticated;
grant execute on function public.noteaza_scor_garaj(uuid, integer, integer, date, date) to service_role;

-- Clasamentul garajului: ca înainte, plus `id` (ca numele să deschidă garajul).
create or replace function public.clasament_garaj(p_luni date default null, p_limita int default 20)
returns json language sql stable security definer set search_path = '' as $$
  with v as (
    select g.jucator, g.masini, g.actualizat,
      case when p_luni is null then g.scor
        else coalesce((select n.start from public.scor_garaj_sapt n where n.jucator = g.jucator and n.luni = p_luni + 7), g.scor) - s.start end val
    from public.scor_garaj g
    left join public.scor_garaj_sapt s on s.jucator = g.jucator and s.luni = p_luni
    where p_luni is null or s.jucator is not null
  ), r as (
    select v.*, j.nume, row_number() over (order by val desc, v.actualizat) loc
    from v join public.jucatori j on j.id = v.jucator
    where val > 0
  )
  select json_build_object(
    'total', (select count(*) from r),
    'top', coalesce((
      select json_agg(json_build_object('loc', loc, 'nume', nume, 'id', jucator, case when p_luni is null then 'garaj' else 'crestere' end, val, 'masini', masini, 'eu', jucator = (select auth.uid())) order by loc)
      from r where loc <= least(greatest(p_limita, 1), 50)
    ), '[]'::json),
    'eu', (select json_build_object('loc', loc, 'id', jucator, case when p_luni is null then 'garaj' else 'crestere' end, val, 'masini', masini) from r where jucator = (select auth.uid()))
  );
$$;

-- Garajul cuiva, de văzut: numele, scorul, câte mașini și cele mai tunate exemplare
-- (cheile și nivelurile; scorul fiecăreia îl socotește pagina). După id sau ID-ul public.
create function public.garaj_public(p_cine text)
returns json language sql stable security definer set search_path = '' as $$
  with j as (
    select id, nume, id_public from public.jucatori
    where (p_cine ~ '^[0-9a-f-]{36}$' and id = p_cine::uuid) or id_public = lower(p_cine)
    limit 1
  )
  select case when not exists (select 1 from j) then null else json_build_object(
    'nume', (select nume from j),
    'id_public', (select id_public from j),
    'eu', (select id from j) = (select auth.uid()),
    'scor', (select scor from public.scor_garaj where jucator = (select id from j)),
    'masini', (select count(*) from public.garaje where jucator = (select id from j)),
    'legendare', (select count(*) from public.garaje where jucator = (select id from j) and raritate = 4),
    'seturi', (select count(*) from public.miscari where jucator = (select id from j) and motiv = 'set complet'),
    'exemplare', coalesce((select json_agg(json_build_object('masina', masina, 'nivel', nivel)) from (
      select masina, nivel from public.exemplare where jucator = (select id from j)
      order by public.nivel_total(nivel) desc, id limit 40) x), '[]'::json),
    'chei', coalesce((select json_agg(masina) from public.garaje where jucator = (select id from j)), '[]'::json)
  ) end;
$$;
revoke all on function public.garaj_public(text) from public;
grant execute on function public.garaj_public(text) to anon, authenticated;

-- ---------- codurile de la evenimente ----------
create table public.evenimente (
  cod text primary key check (cod ~ '^[A-Z0-9]{4,12}$'),
  nume text not null,
  de_la timestamptz not null default now(),
  pana_la timestamptz not null,
  -- { mil?, lazi?, pachete? }: pachete = Pachete Sport gratis
  premiu jsonb not null default '{"pachete": 1}'::jsonb,
  max int,
  creat timestamptz not null default now()
);
create table public.evenimente_luate (
  cod text not null references public.evenimente(cod) on delete cascade,
  jucator uuid not null references public.jucatori(id) on delete cascade,
  creat timestamptz not null default now(),
  primary key (cod, jucator)
);
alter table public.evenimente enable row level security;
alter table public.evenimente_luate enable row level security;
grant select, insert, update, delete on public.evenimente, public.evenimente_luate to service_role;

create function public.eveniment_ia(p_jucator uuid, p_cod text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  e public.evenimente;
  m numeric;
  l int;
  pk int;
begin
  select * into e from public.evenimente where cod = upper(p_cod);
  if not found then return json_build_object('eroare', 'cod'); end if;
  if now() < e.de_la or now() > e.pana_la then return json_build_object('eroare', 'expirat', 'nume', e.nume); end if;
  if e.max is not null and (select count(*) from public.evenimente_luate where cod = e.cod) >= e.max then
    return json_build_object('eroare', 'epuizat', 'nume', e.nume);
  end if;
  insert into public.evenimente_luate (cod, jucator) values (e.cod, p_jucator) on conflict do nothing;
  if not found then return json_build_object('eroare', 'deja', 'nume', e.nume); end if;
  m := coalesce((e.premiu ->> 'mil')::numeric, 0);
  l := coalesce((e.premiu ->> 'lazi')::int, 0);
  pk := coalesce((e.premiu ->> 'pachete')::int, 0);
  update public.portofele set mil = mil + m, lazi_gratis = lazi_gratis + l, pachete_gratis = pachete_gratis + pk, actualizat = now()
  where jucator = p_jucator;
  insert into public.miscari (jucator, mil, lazi, motiv, cheie, detalii)
  values (p_jucator, m, l, 'eveniment', 'eveniment:' || e.cod, jsonb_build_object('nume', e.nume, 'pachete', pk));
  return json_build_object('ok', true, 'nume', e.nume, 'mil', m, 'lazi', l, 'pachete', pk);
end;
$$;
revoke all on function public.eveniment_ia(uuid, text) from public, anon, authenticated;
grant execute on function public.eveniment_ia(uuid, text) to service_role;
