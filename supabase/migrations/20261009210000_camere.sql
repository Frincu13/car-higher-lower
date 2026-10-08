-- Camere private: doi prieteni, fiecare pe telefonul lui, la un joc pe rând
-- (întâi Licitația). Serverul ține starea întreagă în `camere_secret` (loturile care
-- urmează, categoriile ascunse, așezările); în `camere.public` stă doar ce au voie
-- să vadă amândoi, iar schimbările de acolo ajung la telefoane prin Realtime.
-- Miza (opțională, în mil.) se blochează la intrare; câștigătorul ia potul minus 10%.

create table public.camere (
  id uuid primary key default gen_random_uuid(),
  cod text not null unique,
  joc text not null check (joc in ('licitatie', 'draft')),
  a uuid not null references public.jucatori (id) on delete cascade,
  b uuid references public.jucatori (id) on delete set null,
  miza integer not null default 0 check (miza >= 0),
  stare text not null default 'asteapta' check (stare in ('asteapta', 'joc', 'gata', 'anulata')),
  public jsonb not null default '{}'::jsonb,
  v integer not null default 0,
  platit boolean not null default false,
  creat timestamptz not null default now(),
  actualizat timestamptz not null default now()
);
create index camere_a on public.camere (a, creat desc);
create index camere_b on public.camere (b, creat desc);
alter table public.camere enable row level security;
create policy "camere: ale tale" on public.camere for select to authenticated
  using (a = (select auth.uid()) or b = (select auth.uid()));
grant select on public.camere to authenticated;
grant select, insert, update, delete on public.camere to service_role;

create table public.camere_secret (
  id uuid primary key references public.camere (id) on delete cascade,
  joc jsonb not null
);
alter table public.camere_secret enable row level security;
grant select, insert, update, delete on public.camere_secret to service_role;

alter publication supabase_realtime add table public.camere;

-- Camera nouă: miza (dacă e) se blochează acum.
create or replace function public.camera_creeaza(p_jucator uuid, p_joc text, p_miza int, p_cod text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
  v_id uuid;
begin
  if p_miza > 0 then
    select * into p from public.portofele where jucator = p_jucator for update;
    if not found or p.mil < p_miza then return json_build_object('eroare', 'bani'); end if;
    update public.portofele set mil = mil - p_miza, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, -p_miza, 'miza camera', json_build_object('cod', p_cod)::jsonb);
  end if;
  insert into public.camere (cod, joc, a, miza, public) values (p_cod, p_joc, p_jucator, p_miza, json_build_object('faza', 'asteapta')::jsonb)
  returning id into v_id;
  return json_build_object('id', v_id, 'cod', p_cod);
end;
$$;

-- Al doilea intră: își blochează miza, iar camera trece în joc.
create or replace function public.camera_intra(p_camera uuid, p_jucator uuid)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  c public.camere;
  p public.portofele;
begin
  select * into c from public.camere where id = p_camera for update;
  if not found then return json_build_object('eroare', 'camera'); end if;
  if c.a = p_jucator then return json_build_object('eroare', 'a ta'); end if;
  if c.stare <> 'asteapta' then return json_build_object('eroare', 'stare'); end if;
  if c.miza > 0 then
    select * into p from public.portofele where jucator = p_jucator for update;
    if not found or p.mil < c.miza then return json_build_object('eroare', 'bani'); end if;
    update public.portofele set mil = mil - c.miza, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, -c.miza, 'miza camera', json_build_object('cod', c.cod)::jsonb);
  end if;
  update public.camere set b = p_jucator, stare = 'joc', actualizat = now() where id = p_camera;
  return json_build_object('ok', true);
end;
$$;

-- Cine a făcut camera renunță cât încă nu a intrat nimeni: miza se întoarce.
create or replace function public.camera_anuleaza(p_camera uuid, p_jucator uuid)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  c public.camere;
begin
  select * into c from public.camere where id = p_camera for update;
  if not found or c.a <> p_jucator then return json_build_object('eroare', 'camera'); end if;
  if c.stare <> 'asteapta' then return json_build_object('eroare', 'stare'); end if;
  if c.miza > 0 then
    update public.portofele set mil = mil + c.miza, actualizat = now() where jucator = c.a;
    insert into public.miscari (jucator, mil, motiv, detalii) values (c.a, c.miza, 'camera anulata', json_build_object('cod', c.cod)::jsonb);
  end if;
  update public.camere set stare = 'anulata', public = json_build_object('faza', 'anulata')::jsonb, v = v + 1, actualizat = now() where id = p_camera;
  return json_build_object('ok', true);
end;
$$;

-- Salvarea unei mutări: doar dacă nimeni n-a schimbat camera între timp (versiunea).
create or replace function public.camera_salveaza(p_camera uuid, p_v int, p_public jsonb, p_joc jsonb, p_stare text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  nou int;
begin
  update public.camere set public = p_public, v = v + 1, stare = p_stare, actualizat = now()
  where id = p_camera and v = p_v
  returning v into nou;
  if not found then return null; end if;
  insert into public.camere_secret (id, joc) values (p_camera, p_joc)
  on conflict (id) do update set joc = excluded.joc;
  return nou;
end;
$$;

-- Plata la final, o singură dată: potul minus comisionul la câștigător, la egal miza înapoi.
create or replace function public.camera_incheie(p_camera uuid, p_castigator uuid)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  c public.camere;
  premiu int;
begin
  select * into c from public.camere where id = p_camera for update;
  if not found or c.platit then return json_build_object('deja', true); end if;
  update public.camere set platit = true where id = p_camera;
  if c.miza = 0 or c.b is null then return json_build_object('ok', true); end if;
  if p_castigator is null then
    update public.portofele set mil = mil + c.miza, actualizat = now() where jucator in (c.a, c.b);
    insert into public.miscari (jucator, mil, motiv, detalii)
    select j, c.miza, 'camera egal', json_build_object('cod', c.cod)::jsonb from unnest(array[c.a, c.b]) j;
    return json_build_object('egal', true);
  end if;
  premiu := 2 * c.miza - public.duel_comision(c.miza);
  update public.portofele set mil = mil + premiu, actualizat = now() where jucator = p_castigator;
  insert into public.miscari (jucator, mil, motiv, detalii) values (p_castigator, premiu, 'camera castigata', json_build_object('cod', c.cod)::jsonb);
  return json_build_object('premiu', premiu);
end;
$$;

revoke all on function public.camera_creeaza(uuid, text, int, text) from public, anon, authenticated;
revoke all on function public.camera_intra(uuid, uuid) from public, anon, authenticated;
revoke all on function public.camera_anuleaza(uuid, uuid) from public, anon, authenticated;
revoke all on function public.camera_salveaza(uuid, int, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.camera_incheie(uuid, uuid) from public, anon, authenticated;
grant execute on function public.camera_creeaza(uuid, text, int, text) to service_role;
grant execute on function public.camera_intra(uuid, uuid) to service_role;
grant execute on function public.camera_anuleaza(uuid, uuid) to service_role;
grant execute on function public.camera_salveaza(uuid, int, jsonb, jsonb, text) to service_role;
grant execute on function public.camera_incheie(uuid, uuid) to service_role;
