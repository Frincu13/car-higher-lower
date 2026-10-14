-- Prietenii sunt doar pentru conturile legate de mail (ca la jocurile mari: joci fără
-- cont, dar socialul cere cont): un cont anonim se poate pierde cu tot cu prieteniile
-- lui, iar în listă fiecare are un @ID. Jocul cu un prieten prin codul camerei rămâne
-- pentru oricine.

-- ce era deja (nu ar trebui să fie nimic): prietenii cu un cont anonim
delete from public.prieteni p where exists (select 1 from auth.users u where u.is_anonymous and u.id in (p.de, p.catre));

create or replace function public.e_legat(p_jucator uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select not is_anonymous from auth.users where id = p_jucator), false) $$;

-- Cererea: amândoi cu cont legat.
create or replace function public.prieten_cere(p_jucator uuid, p_cod text, p_max int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_el uuid;
  r public.prieteni;
begin
  if not public.e_legat(p_jucator) then return json_build_object('eroare', 'cont nelegat'); end if;
  select jucator into v_el from public.invitatii_coduri where cod = upper(trim(p_cod));
  if not found then
    select id into v_el from public.jucatori where id_public = lower(trim(both '@ ' from p_cod));
    if not found then return json_build_object('eroare', 'cod'); end if;
  end if;
  if v_el = p_jucator then return json_build_object('eroare', 'propriu'); end if;
  if not public.e_legat(v_el) then return json_build_object('eroare', 'el nelegat'); end if;
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

-- Prietenia din linkul de invitație: abia când amândoi au cont legat (la starea
-- paginii Prieteni a oricăruia dintre ei).
create or replace function public.prieteni_din_invitatii(p_jucator uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.prieteni (de, catre, stare)
  select i.de, i.invitat, 'prieteni' from public.invitatii i
  where (i.de = p_jucator or i.invitat = p_jucator) and public.e_legat(i.de) and public.e_legat(i.invitat)
    and not exists (select 1 from public.prieteni p where (p.de = i.de and p.catre = i.invitat) or (p.de = i.invitat and p.catre = i.de))
  on conflict do nothing
$$;

-- Invitația prin link: bonusul pe loc, fără prietenie (vine la legare, mai sus).
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

revoke all on function public.e_legat(uuid) from public, anon, authenticated;
revoke all on function public.prieteni_din_invitatii(uuid) from public, anon, authenticated;
grant execute on function public.e_legat(uuid) to service_role;
grant execute on function public.prieteni_din_invitatii(uuid) to service_role;
