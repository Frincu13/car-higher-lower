-- Prietenii prin link, fără cod de dat: linkul tău (`index.html?inv=frincu`) poartă
-- ID-ul (sau codul vechi, la cine nu și-a ales ID). Cine îl deschide și apasă
-- „Adaugă" devine prietenul tău pe loc: ai trimis linkul, deci ai spus deja da.
-- Același link e și invitația cu bonus pentru un cont nou.

-- Linkul -> jucătorul. ID-urile sunt cu litere mici, codurile cu mari (fără 0/O/1/I/L),
-- deci un text cu litere mici e un ID; altfel (și ca rezervă) un cod.
create or replace function public.jucator_din_link(p text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select id from public.jucatori where p ~ '^@?[a-z0-9_.]{3,16}$' and id_public = ltrim(p, '@')),
    (select jucator from public.invitatii_coduri where cod = upper(trim(p))))
$$;

create or replace function public.prieten_din_link(p_jucator uuid, p_cod text, p_max int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_el uuid;
  v_nume text;
  r public.prieteni;
begin
  v_el := public.jucator_din_link(p_cod);
  if v_el is null then return json_build_object('eroare', 'cod'); end if;
  if v_el = p_jucator then return json_build_object('eroare', 'propriu'); end if;
  select nume into v_nume from public.jucatori where id = v_el;
  if not public.e_legat(p_jucator) then return json_build_object('eroare', 'cont nelegat', 'nume', v_nume); end if;
  if not public.e_legat(v_el) then return json_build_object('eroare', 'el nelegat', 'nume', v_nume); end if;
  select * into r from public.prieteni where (de = p_jucator and catre = v_el) or (de = v_el and catre = p_jucator) for update;
  if found then
    if r.stare = 'prieteni' then return json_build_object('eroare', 'deja', 'nume', v_nume); end if;
    update public.prieteni set stare = 'prieteni' where de = r.de and catre = r.catre;
    return json_build_object('prieteni', true, 'id', v_el, 'nume', v_nume);
  end if;
  if (select count(*) from public.prieteni where de = p_jucator or catre = p_jucator) >= p_max
     or (select count(*) from public.prieteni where de = v_el or catre = v_el) >= p_max then
    return json_build_object('eroare', 'prea multi', 'nume', v_nume);
  end if;
  insert into public.prieteni (de, catre, stare) values (v_el, p_jucator, 'prieteni');
  return json_build_object('prieteni', true, 'id', v_el, 'nume', v_nume);
end;
$$;

-- Invitația cu bonus primește și ID-ul din link.
create or replace function public.inregistreaza_invitatie(p_jucator uuid, p_cod text, p_bonus int, p_zile_cont int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_de uuid;
  v_creat timestamptz;
begin
  v_de := public.jucator_din_link(p_cod);
  if v_de is null then return json_build_object('eroare', 'cod'); end if;
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

revoke all on function public.jucator_din_link(text) from public, anon, authenticated;
revoke all on function public.prieten_din_link(uuid, text, int) from public, anon, authenticated;
grant execute on function public.jucator_din_link(text) to service_role;
grant execute on function public.prieten_din_link(uuid, text, int) to service_role;
