-- Duelurile: încercarea se consumă de la start, ca la Cupă. Când apare ecranul
-- cursei, telefonul notează pornirea (duel_porneste); după aceea, un start fals sau o
-- cursă netrimisă costă cât o înfrângere (toată miza pe bani), nu taxa de abandon de
-- 10%. Altfel un duel prost început se putea anula ieftin și reîncerca. „Aleargă
-- acum" (reluarea unui duel rămas fără răspuns) merge doar pentru o cursă nepornită.

alter table public.dueluri add column if not exists pornit_a timestamptz;
alter table public.dueluri add column if not exists pornit_b timestamptz;

-- taxa când A renunță: înainte de start 10% (cel puțin 1 mil.), după start toată miza;
-- pe acte, mașina se întoarce, iar taxa e 1 mil. înainte de start și 10 mil. după
create or replace function public.duel_taxa_abandon(d public.dueluri)
returns int
language sql immutable set search_path = ''
as $$
  select case
    when d.tip = 'bani' and d.pornit_a is not null then d.miza
    when d.tip = 'bani' then greatest(1, floor(d.miza * 0.1)::int)
    when d.pornit_a is not null then 10
    else 1 end
$$;

create or replace function public.duel_porneste(p_duel uuid, p_jucator uuid)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
begin
  select * into d from public.dueluri where id = p_duel for update;
  if not found then return json_build_object('eroare', 'duel'); end if;
  if d.termen < now() then return json_build_object('eroare', 'stare'); end if;
  if d.a = p_jucator and d.stare = 'pregatit' then
    if d.pornit_a is not null then return json_build_object('eroare', 'pornit'); end if;
    update public.dueluri set pornit_a = now() where id = p_duel;
  elsif d.b = p_jucator and d.stare = 'acceptat' then
    if d.pornit_b is not null then return json_build_object('eroare', 'pornit'); end if;
    update public.dueluri set pornit_b = now() where id = p_duel;
  else
    return json_build_object('eroare', 'stare');
  end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.duel_anuleaza(p_duel uuid, p_jucator uuid)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
begin
  select * into d from public.dueluri where id = p_duel for update;
  if not found or d.a <> p_jucator then return json_build_object('eroare', 'duel'); end if;
  if d.stare = 'deschis' then
    perform public.duel_elibereaza(d.a, d.tip, d.miza, d.masina_a, 0, 'duel anulat');
  elsif d.stare = 'pregatit' then
    perform public.duel_elibereaza(d.a, d.tip, d.miza, d.masina_a, public.duel_taxa_abandon(d), 'duel abandonat');
  else
    return json_build_object('eroare', 'stare');
  end if;
  update public.dueluri set stare = 'anulat', incheiat = now() where id = p_duel;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.duel_expira()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
  n int := 0;
begin
  for d in select * from public.dueluri where stare in ('pregatit', 'deschis', 'acceptat') and termen < now() for update skip locked loop
    if d.stare = 'pregatit' then
      perform public.duel_elibereaza(d.a, d.tip, d.miza, d.masina_a, public.duel_taxa_abandon(d), 'duel abandonat');
      update public.dueluri set stare = 'anulat', incheiat = now() where id = d.id;
    elsif d.stare = 'deschis' then
      perform public.duel_elibereaza(d.a, d.tip, d.miza, d.masina_a, 0, 'duel neacceptat');
      update public.dueluri set stare = 'expirat', incheiat = now() where id = d.id;
    else
      perform public.duel_incheie(d.id);
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.duel_taxa_abandon(public.dueluri) from public, anon, authenticated;
revoke all on function public.duel_porneste(uuid, uuid) from public, anon, authenticated;
grant execute on function public.duel_taxa_abandon(public.dueluri) to service_role;
grant execute on function public.duel_porneste(uuid, uuid) to service_role;
