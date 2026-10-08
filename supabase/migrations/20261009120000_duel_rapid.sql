-- Duel rapid: alegi miza și mașina, iar serverul îți găsește adversarul. Dacă cineva
-- din aceeași clasă și cu aceeași miză a alergat deja și așteaptă, alergi contra
-- cursei lui; altfel alergi tu primul și aștepți următorul venit (24 de ore, apoi
-- miza se întoarce). Nu-ți alegi adversarul, deci nu poți juca contra propriului
-- cont ca să-ți treci bani: de aceea doar duelurile rapide intră în clasamentul
-- zilei la Startul (câștigul net în mil.). Doar pe bani.

alter table public.dueluri add column rapid boolean not null default false;
create index dueluri_rapid on public.dueluri (raritate, miza, creat) where rapid and stare = 'deschis';
create index dueluri_rapid_zi on public.dueluri (incheiat) where rapid and stare = 'incheiat';

-- Potrivirea și blocarea mizei, totul sau nimic. Cel mai vechi duel care așteaptă,
-- din aceeași clasă și cu aceeași miză, al altcuiva, cu cine n-ai mai avut un duel
-- rapid în ultimele 24 de ore. Cel mult 3 dueluri rapide în așteptare pe jucător.
create or replace function public.duel_rapid(p_jucator uuid, p_miza int, p_masina text, p_clasa int, p_nivel int, p_cod text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  r json;
begin
  if (select count(*) from public.dueluri where a = p_jucator and rapid and stare in ('pregatit', 'deschis')) >= 3 then
    return json_build_object('eroare', 'prea multe');
  end if;
  select d.id into v_id from public.dueluri d
  where d.rapid and d.stare = 'deschis' and d.termen > now() and d.tip = 'bani'
    and d.raritate = p_clasa and d.miza = p_miza and d.a <> p_jucator
    and not exists (
      select 1 from public.dueluri x
      where x.rapid and x.creat > now() - interval '24 hours'
        and ((x.a = d.a and x.b = p_jucator) or (x.a = p_jucator and x.b = d.a))
    )
  order by d.creat
  limit 1
  for update skip locked;
  if found then
    r := public.duel_accepta(v_id, p_jucator, p_masina, p_clasa, p_nivel);
    if r->>'eroare' is not null then return r; end if;
    return json_build_object('rol', 'b', 'id', v_id);
  end if;
  r := public.duel_creeaza(p_jucator, 'bani', p_miza, p_masina, p_cod, p_clasa, p_nivel);
  if r->>'eroare' is not null then return r; end if;
  update public.dueluri set rapid = true where id = (r->>'id')::uuid;
  return json_build_object('rol', 'a', 'id', r->>'id', 'cod', p_cod);
end;
$$;
revoke all on function public.duel_rapid(uuid, int, text, int, int, text) from public, anon, authenticated;
grant execute on function public.duel_rapid(uuid, int, text, int, int, text) to service_role;

-- Clasamentul zilei la Startul: câștigul net din duelurile rapide încheiate în ziua
-- aceea (ora României). Câștigătorul primește miza celuilalt minus comisionul, cel
-- care pierde își pierde miza, la egal nimic. Public sunt doar numele și sumele.
create or replace function public.clasament_bani(p_data date, p_limita int default 20)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select a, b, miza, castigator from public.dueluri
    where rapid and stare = 'incheiat' and b is not null
      and (incheiat at time zone 'Europe/Bucharest')::date = p_data
  ), m as (
    select a as jucator, castigator = a as v, castigator is not null and castigator <> a as p, miza from d
    union all
    select b, castigator = b, castigator is not null and castigator <> b, miza from d
  ), s as (
    select jucator,
           sum(case when v then miza - public.duel_comision(miza) when p then -miza else 0 end)::int as net,
           count(*) filter (where v)::int as victorii,
           count(*)::int as dueluri
    from m group by jucator
  ), r as (
    select s.*, j.nume, row_number() over (order by s.net desc, s.victorii desc, s.dueluri) as loc
    from s join public.jucatori j on j.id = s.jucator
  )
  select json_build_object(
    'total', (select count(*) from r),
    'top', coalesce((
      select json_agg(json_build_object('loc', loc, 'nume', nume, 'net', net, 'victorii', victorii, 'dueluri', dueluri, 'eu', jucator = (select auth.uid())) order by loc)
      from r where loc <= least(greatest(p_limita, 1), 50)
    ), '[]'::json),
    'eu', (select json_build_object('loc', loc, 'net', net, 'victorii', victorii, 'dueluri', dueluri) from r where jucator = (select auth.uid()))
  );
$$;
revoke all on function public.clasament_bani(date, int) from public;
grant execute on function public.clasament_bani(date, int) to anon, authenticated, service_role;
