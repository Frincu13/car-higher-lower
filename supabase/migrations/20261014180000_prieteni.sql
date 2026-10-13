-- Prieteni: o cerere (de -> catre) devine prietenie când celălalt o acceptă. Codul
-- de prieten e același cu cel de invitație (invitatii_coduri). Invitațiile la joc
-- leagă o cameră care așteaptă (camere) de un prieten; expiră odată cu camera.

create table public.prieteni (
  de uuid not null references public.jucatori (id) on delete cascade,
  catre uuid not null references public.jucatori (id) on delete cascade,
  stare text not null default 'cerere' check (stare in ('cerere', 'prieteni')),
  creat timestamptz not null default now(),
  primary key (de, catre),
  check (de <> catre)
);
create index prieteni_catre on public.prieteni (catre);
alter table public.prieteni enable row level security;
grant select, insert, update, delete on public.prieteni to service_role;

create table public.invitatii_joc (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references public.jucatori (id) on delete cascade,
  catre uuid not null references public.jucatori (id) on delete cascade,
  camera uuid not null references public.camere (id) on delete cascade,
  joc text not null,
  cod text not null,
  creat timestamptz not null default now(),
  unique (camera, catre)
);
create index invitatii_joc_catre on public.invitatii_joc (catre, creat desc);
alter table public.invitatii_joc enable row level security;
grant select, insert, update, delete on public.invitatii_joc to service_role;

-- Cerere de prietenie după cod. Dacă celălalt ți-a trimis deja una, sunteți prieteni.
create or replace function public.prieten_cere(p_jucator uuid, p_cod text, p_max int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_el uuid;
  r public.prieteni;
begin
  select jucator into v_el from public.invitatii_coduri where cod = upper(trim(p_cod));
  if not found then return json_build_object('eroare', 'cod'); end if;
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

-- Lista pentru pagina Prieteni: prietenii, cererile (primite și trimise) și
-- invitațiile la joc încă valabile (camera mai așteaptă).
create or replace function public.prietenii_mei(p_jucator uuid)
returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'prieteni', coalesce((select json_agg(json_build_object('id', j.id, 'nume', j.nume) order by j.nume)
      from public.prieteni p join public.jucatori j on j.id = case when p.de = p_jucator then p.catre else p.de end
      where (p.de = p_jucator or p.catre = p_jucator) and p.stare = 'prieteni'), '[]'::json),
    'primite', coalesce((select json_agg(json_build_object('id', j.id, 'nume', j.nume) order by p.creat desc)
      from public.prieteni p join public.jucatori j on j.id = p.de where p.catre = p_jucator and p.stare = 'cerere'), '[]'::json),
    'trimise', coalesce((select json_agg(json_build_object('id', j.id, 'nume', j.nume) order by p.creat desc)
      from public.prieteni p join public.jucatori j on j.id = p.catre where p.de = p_jucator and p.stare = 'cerere'), '[]'::json),
    'invitatii', coalesce((select json_agg(json_build_object('id', i.id, 'de', j.nume, 'joc', i.joc, 'cod', i.cod, 'miza', c.miza, 'creat', i.creat) order by i.creat desc)
      from public.invitatii_joc i join public.jucatori j on j.id = i.de join public.camere c on c.id = i.camera
      where i.catre = p_jucator and c.stare = 'asteapta' and c.b is null and i.creat > now() - interval '30 minutes'), '[]'::json)
  )
$$;

-- Cine intră din linkul de invitație al cuiva devine și prietenul lui.
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
  insert into public.prieteni (de, catre, stare) values (v_de, p_jucator, 'prieteni') on conflict do nothing;
  perform public.recompensa(p_jucator, p_bonus, 0, 'invitat', 'invitat',
    json_build_object('de', (select nume from public.jucatori where id = v_de))::jsonb);
  return json_build_object('ok', true, 'de', (select nume from public.jucatori where id = v_de));
end;
$$;

revoke all on function public.prieten_cere(uuid, text, int) from public, anon, authenticated;
revoke all on function public.prietenii_mei(uuid) from public, anon, authenticated;
grant execute on function public.prieten_cere(uuid, text, int) to service_role;
grant execute on function public.prietenii_mei(uuid) to service_role;
