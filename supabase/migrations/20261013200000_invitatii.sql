-- Invită un prieten: fiecare jucător are un cod; cine intră cu el pe un cont nou
-- primește un bonus pe loc, iar cel care l-a invitat primește premiul abia după ce
-- prietenul a jucat provocările zilei în câteva zile diferite (ca să nu merite
-- conturi făcute doar pentru premiu). Plătit pentru cel mult câțiva prieteni.

create table public.invitatii_coduri (
  jucator uuid primary key references public.jucatori (id) on delete cascade,
  cod text not null unique,
  creat timestamptz not null default now()
);
alter table public.invitatii_coduri enable row level security;
grant select, insert, update, delete on public.invitatii_coduri to service_role;

create table public.invitatii (
  invitat uuid primary key references public.jucatori (id) on delete cascade,
  de uuid not null references public.jucatori (id) on delete cascade,
  creat timestamptz not null default now(),
  platit timestamptz
);
create index invitatii_de on public.invitatii (de);
alter table public.invitatii enable row level security;
grant select, insert, update, delete on public.invitatii to service_role;

-- Zilele în care a jucat cineva o provocare (Startul sau celelalte jocuri).
create or replace function public.zile_jucate(p_jucator uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(distinct d)::int from (
    select data as d from public.scoruri_zi where jucator = p_jucator
    union select data from public.zi_rezultate where jucator = p_jucator
  ) z
$$;

-- Un cont nou intră cu un cod: o singură dată, doar în primele zile ale contului,
-- nu cu propriul cod. Bonusul se dă pe loc.
create or replace function public.inregistreaza_invitatie(p_jucator uuid, p_cod text, p_bonus int, p_zile_cont int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_de uuid;
  v_creat timestamptz;
begin
  select jucator into v_de from public.invitatii_coduri where cod = upper(trim(p_cod));
  if not found then return json_build_object('eroare', 'cod'); end if;
  if v_de = p_jucator then return json_build_object('eroare', 'propriu'); end if;
  if exists (select 1 from public.invitatii where invitat = p_jucator) then return json_build_object('eroare', 'deja'); end if;
  select created_at into v_creat from auth.users where id = p_jucator;
  if v_creat is null or v_creat < now() - make_interval(days => p_zile_cont) then return json_build_object('eroare', 'vechi'); end if;
  insert into public.invitatii (invitat, de) values (p_jucator, v_de);
  perform public.recompensa(p_jucator, p_bonus, 0, 'invitat', 'invitat',
    json_build_object('de', (select nume from public.jucatori where id = v_de))::jsonb);
  return json_build_object('ok', true, 'de', (select nume from public.jucatori where id = v_de));
end;
$$;

-- Premiul celui care a invitat: pentru fiecare prieten care a jucat `p_zile` zile,
-- până la `p_max` prieteni plătiți în total.
create or replace function public.plateste_invitatii(p_jucator uuid, p_suma int, p_zile int, p_max int)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  x record;
  platiti int;
  noi int := 0;
begin
  select count(*) into platiti from public.invitatii where de = p_jucator and platit is not null;
  for x in select i.invitat, j.nume from public.invitatii i join public.jucatori j on j.id = i.invitat
           where i.de = p_jucator and i.platit is null order by i.creat limit 50 loop
    exit when platiti >= p_max;
    if public.zile_jucate(x.invitat) >= p_zile then
      update public.invitatii set platit = now() where invitat = x.invitat and platit is null;
      if found then
        perform public.recompensa(p_jucator, p_suma, 0, 'prieten invitat', 'invitatie:' || x.invitat,
          json_build_object('nume', x.nume)::jsonb);
        platiti := platiti + 1;
        noi := noi + 1;
      end if;
    end if;
  end loop;
  return noi;
end;
$$;

-- Ce vede jucătorul pe pagina „Invită un prieten".
create or replace function public.invitatiile_mele(p_jucator uuid)
returns json
language sql stable security definer set search_path = ''
as $$
  select coalesce(json_agg(json_build_object('nume', j.nume, 'zile', public.zile_jucate(i.invitat), 'platit', i.platit is not null) order by i.creat desc), '[]'::json)
  from (select * from public.invitatii where de = p_jucator order by creat desc limit 30) i
  join public.jucatori j on j.id = i.invitat
$$;

revoke all on function public.zile_jucate(uuid) from public, anon, authenticated;
revoke all on function public.inregistreaza_invitatie(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.plateste_invitatii(uuid, int, int, int) from public, anon, authenticated;
revoke all on function public.invitatiile_mele(uuid) from public, anon, authenticated;
grant execute on function public.zile_jucate(uuid) to service_role;
grant execute on function public.inregistreaza_invitatie(uuid, text, int, int) to service_role;
grant execute on function public.plateste_invitatii(uuid, int, int, int) to service_role;
grant execute on function public.invitatiile_mele(uuid) to service_role;
