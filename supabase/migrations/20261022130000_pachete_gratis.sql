-- Pachete gratis: un Pachet Sport la fiecare 7 zile de serie (7, 14, 21...). Stau în
-- portofel ca lăzile gratis și se deschid din Colecție fără să coste.
alter table public.portofele add column if not exists pachete_gratis integer not null default 0 check (pachete_gratis >= 0);

-- Un pachet gratis, o singură dată pe cheie (ca recompensa).
create or replace function public.da_pachet_gratis(p_jucator uuid, p_motiv text, p_cheie text, p_detalii jsonb default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.miscari (jucator, mil, lazi, motiv, cheie, detalii)
  values (p_jucator, 0, 0, p_motiv, p_cheie, coalesce(p_detalii, '{}'::jsonb) || '{"pachete": 1}'::jsonb)
  on conflict (jucator, cheie) do nothing;
  if not found then return false; end if;
  update public.portofele set pachete_gratis = pachete_gratis + 1, actualizat = now() where jucator = p_jucator;
  return true;
end;
$$;

-- Deschiderea: la `p_gratis`, se ia un pachet gratis în loc de bani (în `miscari` ca 'lada gratis',
-- ca să conteze la misiuni și în profil, ca lăzile gratis).
drop function if exists public.deschide_pachet(uuid, text, int, text[], int[]);
create or replace function public.deschide_pachet(p_jucator uuid, p_pachet text, p_pret int, p_masini text[], p_raritati int[], p_gratis boolean default false)
returns json language plpgsql security definer set search_path = '' as $$
declare
  p public.portofele;
  nr int;
  rez json[] := '{}';
  i int;
begin
  if coalesce(array_length(p_masini, 1), 0) = 0 or array_length(p_masini, 1) <> array_length(p_raritati, 1) then
    return json_build_object('eroare', 'pachet');
  end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'portofel'); end if;
  if p_gratis then
    if p.pachete_gratis < 1 then return json_build_object('eroare', 'fara pachete gratis'); end if;
    update public.portofele set pachete_gratis = pachete_gratis - 1, actualizat = now() where jucator = p_jucator;
  else
    if p.mil < p_pret then return json_build_object('eroare', 'bani'); end if;
    update public.portofele set mil = mil - p_pret, actualizat = now() where jucator = p_jucator;
  end if;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, case when p_gratis then 0 else -p_pret end, case when p_gratis then 'lada gratis' else 'lada' end,
    json_build_object('pachet', p_pachet, 'masini', p_masini)::jsonb);
  for i in 1..array_length(p_masini, 1) loop
    insert into public.garaje (jucator, masina, raritate) values (p_jucator, p_masini[i], p_raritati[i])
    on conflict (jucator, masina) do update set bucati = public.garaje.bucati + 1
    returning bucati into nr;
    rez := rez || json_build_object('noua', nr = 1, 'bucati', nr);
  end loop;
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('carti', array_to_json(rez), 'mil', p.mil, 'lazi_gratis', p.lazi_gratis, 'pachete_gratis', p.pachete_gratis, 'puncte', p.puncte);
end;
$$;

revoke all on function public.da_pachet_gratis(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.deschide_pachet(uuid, text, int, text[], int[], boolean) from public, anon, authenticated;
grant execute on function public.da_pachet_gratis(uuid, text, text, jsonb) to service_role;
grant execute on function public.deschide_pachet(uuid, text, int, text[], int[], boolean) to service_role;
