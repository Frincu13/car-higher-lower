-- Sponsorii FRQ în aplicație, pe niveluri: 1 principal („powered by", lada Hypercar,
-- Cupa), 2 partener (o ladă, clasamentele, ecranul de premii), 3 susținător (pagina
-- Partenerii FRQ). Locurile le alege pagina după nivel; aici doar cine, cât timp și ce
-- lăzi poartă. Cei cu `demo` (inventați, ca să se vadă cum arată) apar doar pe
-- telefoanele în modul demo (?sponsori=demo), niciodată la jucători.
create table public.sponsori (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  nume text not null,
  nivel smallint not null check (nivel between 1 and 3),
  -- ce face, într-un rând („Băuturi energizante")
  descriere text,
  culoare text not null default '#ed1b2f' check (culoare ~ '^#[0-9a-fA-F]{6}$'),
  -- calea spre logo pe site (img/sponsori/x.svg)
  logo text not null,
  link text check (link is null or link ~ '^https://'),
  -- lăzile (id-urile din Economie.LAZI) care îi poartă numele
  lazi text[] not null default '{}',
  de_la timestamptz not null default now(),
  pana_la timestamptz,
  demo boolean not null default false,
  ordine smallint not null default 0
);
alter table public.sponsori enable row level security;
grant select, insert, update, delete on public.sponsori to service_role;

-- De câte ori a fost văzut și atins fiecare, pe loc și pe zi (doar cifre adunate)
create table public.sponsori_cifre (
  sponsor text not null references public.sponsori(id) on delete cascade,
  loc text not null,
  zi date not null,
  afisari int not null default 0,
  clicuri int not null default 0,
  primary key (sponsor, loc, zi)
);
alter table public.sponsori_cifre enable row level security;
grant select, insert, update, delete on public.sponsori_cifre to service_role;

-- Sponsorii de acum, pentru pagină (cu cei demo doar dacă se cer)
create function public.sponsori_activi(p_demo boolean default false)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', id, 'nume', nume, 'nivel', nivel, 'descriere', descriere, 'culoare', culoare,
    'logo', logo, 'link', link, 'lazi', lazi, 'demo', demo) order by nivel, ordine, nume), '[]'::json)
  from public.sponsori
  where de_la <= now() and (pana_la is null or pana_la > now()) and (not demo or p_demo);
$$;
revoke all on function public.sponsori_activi(boolean) from public;
grant execute on function public.sponsori_activi(boolean) to anon, authenticated;

-- Cifrele strânse de o pagină (o dată la plecare): [{ s, l, a, c }]. Fără conturi și
-- fără nimic despre cine a văzut; cu plafoane, ca o pagină stricată să nu umfle cifrele.
create function public.noteaza_sponsori(p_cifre jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  x jsonb;
  v_zi date := (now() at time zone 'Europe/Bucharest')::date;
begin
  if jsonb_typeof(p_cifre) <> 'array' then return; end if;
  for x in select * from jsonb_array_elements(p_cifre) limit 40 loop
    if not exists (select 1 from public.sponsori where id = x->>'s') or coalesce(x->>'l', '') !~ '^[a-z-]{2,20}$' then continue; end if;
    insert into public.sponsori_cifre (sponsor, loc, zi, afisari, clicuri)
    values (x->>'s', x->>'l', v_zi, least(greatest(coalesce((x->>'a')::int, 0), 0), 50), least(greatest(coalesce((x->>'c')::int, 0), 0), 10))
    on conflict (sponsor, loc, zi) do update set afisari = public.sponsori_cifre.afisari + excluded.afisari, clicuri = public.sponsori_cifre.clicuri + excluded.clicuri;
  end loop;
end;
$$;
revoke all on function public.noteaza_sponsori(jsonb) from public;
grant execute on function public.noteaza_sponsori(jsonb) to anon, authenticated;

-- Un eveniment poate fi al unui sponsor: premiul vine „de la" el
alter table public.evenimente add column sponsor text references public.sponsori(id) on delete set null;
create or replace function public.eveniment_ia(p_jucator uuid, p_cod text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  e public.evenimente;
  m numeric;
  l int;
  pk int;
  sp text;
begin
  select * into e from public.evenimente where cod = upper(p_cod);
  if not found then return json_build_object('eroare', 'cod'); end if;
  if now() < e.de_la or now() > e.pana_la then return json_build_object('eroare', 'expirat', 'nume', e.nume); end if;
  if exists (select 1 from public.evenimente_luate where cod = e.cod and jucator = p_jucator) then
    return json_build_object('eroare', 'deja', 'nume', e.nume);
  end if;
  if e.max is not null and (select count(*) from public.evenimente_luate where cod = e.cod) >= e.max then
    return json_build_object('eroare', 'epuizat', 'nume', e.nume);
  end if;
  insert into public.evenimente_luate (cod, jucator) values (e.cod, p_jucator) on conflict do nothing;
  if not found then return json_build_object('eroare', 'deja', 'nume', e.nume); end if;
  m := coalesce((e.premiu ->> 'mil')::numeric, 0);
  l := coalesce((e.premiu ->> 'lazi')::int, 0);
  pk := coalesce((e.premiu ->> 'pachete')::int, 0);
  select nume into sp from public.sponsori where id = e.sponsor;
  update public.portofele set mil = mil + m, lazi_gratis = lazi_gratis + l, pachete_gratis = pachete_gratis + pk, actualizat = now()
  where jucator = p_jucator;
  insert into public.miscari (jucator, mil, lazi, motiv, cheie, detalii)
  values (p_jucator, m, l, 'eveniment', 'eveniment:' || e.cod, jsonb_build_object('nume', e.nume, 'pachete', pk, 'sponsor', sp));
  return json_build_object('ok', true, 'nume', e.nume, 'mil', m, 'lazi', l, 'pachete', pk, 'sponsor', sp);
end;
$$;

-- Sponsorii demo (inventați): doar ca să se vadă locurile, pe telefoanele în modul demo
insert into public.sponsori (id, nume, nivel, descriere, culoare, logo, link, lazi, demo, ordine) values
  ('korvo', 'KORVO Energy', 1, 'Băutură energizantă', '#ffcc00', 'img/sponsori/korvo.svg', null, '{hyper}', true, 0),
  ('grivex', 'Grivex Anvelope', 2, 'Anvelope de performanță', '#1fa2ff', 'img/sponsori/grivex.svg', null, '{sport}', true, 1),
  ('ardeo', 'Ardeo Lubrifianți', 2, 'Uleiuri de motor', '#ff6a1a', 'img/sponsori/ardeo.svg', null, '{super}', true, 2),
  ('centura', 'Centura Auto', 2, 'Dealer de mărci germane', '#9aa7b8', 'img/sponsori/centura.svg', null, '{germania}', true, 3),
  ('pista9', 'Pista 9 Café', 3, 'Cafenea pentru pasionați', '#c08a5a', 'img/sponsori/pista9.svg', null, '{}', true, 4),
  ('spumo', 'Spumo Detailing', 3, 'Spălătorie și detailing', '#2ee6c4', 'img/sponsori/spumo.svg', null, '{}', true, 5);
