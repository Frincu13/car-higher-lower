-- Clasamentul Duelului de cărți: victoriile contra botului greu, pe săptămână (de luni
-- până duminică, ora României). La egalitate, cine a avut nevoie de mai puține meciuri,
-- apoi cine a ajuns primul acolo. Partidele se șterg după 3 săptămâni, deci se văd
-- săptămâna asta și cea trecută.
create or replace function public.clasament_carti(p_luni date, p_limita int default 20)
returns json language sql stable security definer set search_path = '' as $$
  with v as (
    select jucator,
      count(*) filter (where (date->>'castigat')::boolean) victorii,
      count(*) meciuri,
      max(terminat) filter (where (date->>'castigat')::boolean) ultima
    from public.partide
    where joc = 'carti' and cat = 'bot2' and scor is not null
      and (terminat at time zone 'Europe/Bucharest')::date between p_luni and p_luni + 6
    group by jucator
  ), r as (
    select v.*, j.nume, row_number() over (order by victorii desc, meciuri, ultima) loc
    from v join public.jucatori j on j.id = v.jucator
    where victorii > 0
  )
  select json_build_object(
    'total', (select count(*) from r),
    'top', coalesce((
      select json_agg(json_build_object('loc', loc, 'nume', nume, 'victorii', victorii, 'meciuri', meciuri, 'eu', jucator = (select auth.uid())) order by loc)
      from r where loc <= least(greatest(p_limita, 1), 50)
    ), '[]'::json),
    'eu', (select json_build_object('loc', loc, 'victorii', victorii, 'meciuri', meciuri) from r where jucator = (select auth.uid()))
  );
$$;
revoke all on function public.clasament_carti(date, int) from public;
grant execute on function public.clasament_carti(date, int) to anon, authenticated;
