-- Jocurile unui sponsor: îi poartă numele pe ecranul de final și în capul clasamentului
-- (id-urile jocurilor: startul, sus-sau-jos, ordine, licitatie, draft, carti, geaman,
-- garaj). Ca la lăzi, un joc are un singur sponsor; unul fără sponsor ia partenerul zilei.
alter table public.sponsori add column jocuri text[] not null default '{}';

create or replace function public.sponsori_activi(p_demo boolean default false)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', id, 'nume', nume, 'nivel', nivel, 'descriere', descriere, 'culoare', culoare,
    'logo', logo, 'link', link, 'lazi', lazi, 'jocuri', jocuri, 'demo', demo) order by nivel, ordine, nume), '[]'::json)
  from public.sponsori
  where de_la <= now() and (pana_la is null or pana_la > now());
$$;

-- Sponsorii de exemplu: principalul ține Startul (cu Cupa) și garajul, partenerii câte două jocuri
update public.sponsori set jocuri = '{startul,garaj}' where id = 'korvo' and demo;
update public.sponsori set jocuri = '{sus-sau-jos,ordine}' where id = 'grivex' and demo;
update public.sponsori set jocuri = '{draft,carti}' where id = 'ardeo' and demo;
update public.sponsori set jocuri = '{licitatie,geaman}' where id = 'centura' and demo;
