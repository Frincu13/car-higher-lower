-- Până vin sponsorii reali, cei de exemplu (demo) apar la toți jucătorii, ca aplicația să
-- arate cu sponsori. Pe pagina Partenerii FRQ rămân marcați „demo". Când intră unul real
-- pe un loc, `tools/sponsori.mjs --opreste <id>` scoate exemplul.
create or replace function public.sponsori_activi(p_demo boolean default false)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', id, 'nume', nume, 'nivel', nivel, 'descriere', descriere, 'culoare', culoare,
    'logo', logo, 'link', link, 'lazi', lazi, 'demo', demo) order by nivel, ordine, nume), '[]'::json)
  from public.sponsori
  where de_la <= now() and (pana_la is null or pana_la > now());
$$;
