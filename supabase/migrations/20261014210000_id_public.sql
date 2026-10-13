-- ID-ul public (@frincu): unic, ales de conturile legate de mail, ca prietenii să te
-- găsească după el. Numele afișat (`nume`) rămâne liber și se poate repeta.

alter table public.jucatori add column if not exists id_public text;
alter table public.jucatori drop constraint if exists jucatori_id_public_forma;
alter table public.jucatori add constraint jucatori_id_public_forma check (id_public is null or id_public ~ '^[a-z0-9_.]{3,16}$');
create unique index if not exists jucatori_id_public on public.jucatori (id_public) where id_public is not null;

-- ID și nume, deodată. Eroare: forma, rezervat sau ocupat.
create or replace function public.seteaza_id_public(p_jucator uuid, p_id text, p_nume text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v text := lower(trim(both '@ ' from coalesce(p_id, '')));
begin
  if v !~ '^[a-z0-9_.]{3,16}$' or v ~ '^[._]|[._]$|\.\.' then return json_build_object('eroare', 'forma'); end if;
  if v ~ '^(frq|admin|administrator|moderator|mod|support|suport|staff|echipa|oficial|official|root|system|sistem|null|undefined)' then
    return json_build_object('eroare', 'rezervat');
  end if;
  if exists (select 1 from public.jucatori where id_public = v and id <> p_jucator) then return json_build_object('eroare', 'ocupat'); end if;
  update public.jucatori set id_public = v, nume = coalesce(nullif(p_nume, ''), nume), actualizat = now() where id = p_jucator;
  return json_build_object('ok', true, 'id_public', v);
exception when unique_violation then
  return json_build_object('eroare', 'ocupat');
end;
$$;

-- Cererea de prietenie: după cod (6 litere) sau după ID (@frincu).
create or replace function public.prieten_cere(p_jucator uuid, p_cod text, p_max int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_el uuid;
  r public.prieteni;
begin
  select jucator into v_el from public.invitatii_coduri where cod = upper(trim(p_cod));
  if not found then
    select id into v_el from public.jucatori where id_public = lower(trim(both '@ ' from p_cod));
    if not found then return json_build_object('eroare', 'cod'); end if;
  end if;
  if v_el = p_jucator then return json_build_object('eroare', 'propriu'); end if;
  select * into r from public.prieteni where (de = p_jucator and catre = v_el) or (de = v_el and catre = p_jucator) for update;
  if found then
    if r.stare = 'prieteni' then return json_build_object('eroare', 'deja'); end if;
    if r.de = p_jucator then return json_build_object('eroare', 'trimisa'); end if;
    update public.prieteni set stare = 'prieteni' where de = r.de and catre = r.catre;
    return json_build_object('prieteni', true, 'id', v_el, 'nume', (select nume from public.jucatori where id = v_el));
  end if;
  if (select count(*) from public.prieteni where de = p_jucator or catre = p_jucator) >= p_max then
    return json_build_object('eroare', 'prea multi');
  end if;
  if (select count(*) from public.prieteni where de = p_jucator and stare = 'cerere' and creat > now() - interval '1 hour') >= 20 then
    return json_build_object('eroare', 'prea multe');
  end if;
  insert into public.prieteni (de, catre) values (p_jucator, v_el);
  return json_build_object('cerere', true, 'id', v_el, 'nume', (select nume from public.jucatori where id = v_el));
end;
$$;

-- Lista Prieteni, cu ID-ul fiecăruia.
create or replace function public.prietenii_mei(p_jucator uuid)
returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'prieteni', coalesce((select json_agg(json_build_object('id', j.id, 'nume', j.nume, 'id_public', j.id_public) order by j.nume)
      from public.prieteni p join public.jucatori j on j.id = case when p.de = p_jucator then p.catre else p.de end
      where (p.de = p_jucator or p.catre = p_jucator) and p.stare = 'prieteni'), '[]'::json),
    'primite', coalesce((select json_agg(json_build_object('id', j.id, 'nume', j.nume, 'id_public', j.id_public) order by p.creat desc)
      from public.prieteni p join public.jucatori j on j.id = p.de where p.catre = p_jucator and p.stare = 'cerere'), '[]'::json),
    'trimise', coalesce((select json_agg(json_build_object('id', j.id, 'nume', j.nume, 'id_public', j.id_public) order by p.creat desc)
      from public.prieteni p join public.jucatori j on j.id = p.catre where p.de = p_jucator and p.stare = 'cerere'), '[]'::json),
    'invitatii', coalesce((select json_agg(json_build_object('id', i.id, 'de', j.nume, 'joc', i.joc, 'cod', i.cod, 'miza', c.miza, 'creat', i.creat) order by i.creat desc)
      from public.invitatii_joc i join public.jucatori j on j.id = i.de join public.camere c on c.id = i.camera
      where i.catre = p_jucator and c.stare = 'asteapta' and c.b is null and i.creat > now() - interval '30 minutes'), '[]'::json),
    'eu', (select json_build_object('nume', nume, 'id_public', id_public) from public.jucatori where id = p_jucator)
  )
$$;

revoke all on function public.seteaza_id_public(uuid, text, text) from public, anon, authenticated;
grant execute on function public.seteaza_id_public(uuid, text, text) to service_role;
