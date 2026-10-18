-- Pachetele: mai multe mașini deodată, plătite o singură dată. Serverul (funcția
-- `portofel`) trage mașinile; aici se ia prețul și intră toate în garaj, atomic.
-- În `miscari` e un singur rând 'lada' (pentru misiunea „deschide o ladă").
create or replace function public.deschide_pachet(p_jucator uuid, p_pachet text, p_pret int, p_masini text[], p_raritati int[])
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
  if p.mil < p_pret then return json_build_object('eroare', 'bani'); end if;
  update public.portofele set mil = mil - p_pret, actualizat = now() where jucator = p_jucator;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, -p_pret, 'lada', json_build_object('pachet', p_pachet, 'masini', p_masini)::jsonb);
  for i in 1..array_length(p_masini, 1) loop
    insert into public.garaje (jucator, masina, raritate) values (p_jucator, p_masini[i], p_raritati[i])
    on conflict (jucator, masina) do update set bucati = public.garaje.bucati + 1
    returning bucati into nr;
    rez := rez || json_build_object('noua', nr = 1, 'bucati', nr);
  end loop;
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('carti', array_to_json(rez), 'mil', p.mil, 'lazi_gratis', p.lazi_gratis, 'puncte', p.puncte);
end;
$$;
revoke all on function public.deschide_pachet(uuid, text, int, text[], int[]) from public, anon, authenticated;
grant execute on function public.deschide_pachet(uuid, text, int, text[], int[]) to service_role;
