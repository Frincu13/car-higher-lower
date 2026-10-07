-- Tuning pe niveluri (0-5) și dueluri pe clase. Clasa e raritatea timpului după
-- tuning (o socotește funcția de pe server cu modelul jocului); în dueluri, coloana
-- `raritate` ține de acum clasa. Nivelul fiecărei mașini se fixează la începutul
-- duelului, iar pe acte câștigătorul primește mașina cu tot cu tuning.

alter table public.dueluri add column nivel_a smallint not null default 0;
alter table public.dueluri add column nivel_b smallint;

-- Un nivel în plus: banii se scad, nivelul crește, totul sau nimic. O mașină pusă
-- într-un duel nu se tunează până nu se termină duelul.
create or replace function public.tuneaza(p_jucator uuid, p_masina text, p_cost int, p_max int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
  g public.garaje;
begin
  select * into g from public.garaje where jucator = p_jucator and masina = p_masina for update;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if g.blocat then return json_build_object('eroare', 'blocata'); end if;
  if g.nivel >= p_max then return json_build_object('eroare', 'maxim'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found or p.mil < p_cost then return json_build_object('eroare', 'bani'); end if;
  update public.portofele set mil = mil - p_cost, actualizat = now() where jucator = p_jucator;
  update public.garaje set nivel = nivel + 1 where jucator = p_jucator and masina = p_masina;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, -p_cost, 'tuning', json_build_object('masina', p_masina, 'nivel', g.nivel + 1)::jsonb);
  return json_build_object('nivel', g.nivel + 1, 'mil', p.mil - p_cost);
end;
$$;
revoke all on function public.tuneaza(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.tuneaza(uuid, text, int, int) to service_role;

-- A își blochează miza; clasa și nivelul vin de la funcția de pe server.
drop function public.duel_creeaza(uuid, text, int, text, text);
create or replace function public.duel_creeaza(p_jucator uuid, p_tip text, p_miza int, p_masina text, p_cod text, p_clasa int, p_nivel int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  niv smallint;
  err text;
  v_id uuid;
begin
  select nivel into niv from public.garaje where jucator = p_jucator and masina = p_masina;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if niv <> p_nivel then return json_build_object('eroare', 'nivel'); end if;
  err := public.duel_blocheaza(p_jucator, p_tip, p_miza, p_masina);
  if err is not null then return json_build_object('eroare', err); end if;
  insert into public.dueluri (cod, tip, miza, raritate, a, masina_a, nivel_a, termen)
  values (p_cod, p_tip, case when p_tip = 'bani' then p_miza else 0 end, p_clasa, p_jucator, p_masina, p_nivel, now() + interval '15 minutes')
  returning id into v_id;
  return json_build_object('id', v_id, 'cod', p_cod, 'clasa', p_clasa);
end;
$$;

-- B acceptă cu o mașină din aceeași clasă.
drop function public.duel_accepta(uuid, uuid, text);
create or replace function public.duel_accepta(p_duel uuid, p_jucator uuid, p_masina text, p_clasa int, p_nivel int)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
  niv smallint;
  err text;
begin
  select * into d from public.dueluri where id = p_duel for update;
  if not found then return json_build_object('eroare', 'duel'); end if;
  if d.stare <> 'deschis' or d.termen < now() then return json_build_object('eroare', 'stare'); end if;
  if d.a = p_jucator then return json_build_object('eroare', 'al tau'); end if;
  select nivel into niv from public.garaje where jucator = p_jucator and masina = p_masina;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if niv <> p_nivel then return json_build_object('eroare', 'nivel'); end if;
  if p_clasa <> d.raritate then return json_build_object('eroare', 'raritate'); end if;
  err := public.duel_blocheaza(p_jucator, d.tip, d.miza, p_masina);
  if err is not null then return json_build_object('eroare', err); end if;
  update public.dueluri set b = p_jucator, masina_b = p_masina, nivel_b = p_nivel, stare = 'acceptat', termen = now() + interval '15 minutes'
  where id = p_duel;
  return json_build_object('ok', true);
end;
$$;

-- Încheierea: pe acte, mașina trece cu tot cu nivel (dacă câștigătorul o avea deja,
-- îi rămâne nivelul mai mare dintre cele două).
create or replace function public.duel_incheie(p_duel uuid)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
  castig uuid;
  pierde uuid;
  m_castig text;
  m_pierde text;
  rar smallint;
  niv smallint;
  premiu int;
  avea boolean;
begin
  select * into d from public.dueluri where id = p_duel for update;
  if d.stare <> 'acceptat' then return json_build_object('eroare', 'stare'); end if;
  if d.timp_b is not null and d.timp_a = d.timp_b then
    perform public.duel_elibereaza(d.a, d.tip, d.miza, d.masina_a, 0, 'duel egal');
    perform public.duel_elibereaza(d.b, d.tip, d.miza, d.masina_b, 0, 'duel egal');
    update public.dueluri set stare = 'incheiat', incheiat = now() where id = p_duel;
    return json_build_object('egal', true);
  end if;
  if d.timp_b is null or d.timp_a < d.timp_b then
    castig := d.a; pierde := d.b; m_castig := d.masina_a; m_pierde := d.masina_b;
  else
    castig := d.b; pierde := d.a; m_castig := d.masina_b; m_pierde := d.masina_a;
  end if;
  if d.tip = 'bani' then
    premiu := 2 * d.miza - public.duel_comision(d.miza);
    update public.portofele set mil = mil + premiu, actualizat = now() where jucator = castig;
    insert into public.miscari (jucator, mil, motiv, detalii) values (castig, premiu, 'duel castigat', json_build_object('duel', d.cod)::jsonb);
  else
    update public.garaje set blocat = false where jucator = castig and masina = m_castig;
    select raritate, nivel into rar, niv from public.garaje where jucator = pierde and masina = m_pierde;
    update public.garaje set bucati = bucati - 1, blocat = false where jucator = pierde and masina = m_pierde and bucati > 1;
    if not found then delete from public.garaje where jucator = pierde and masina = m_pierde; end if;
    avea := exists (select 1 from public.garaje where jucator = castig and masina = m_pierde);
    insert into public.garaje (jucator, masina, raritate, nivel) values (castig, m_pierde, rar, coalesce(niv, 0))
    on conflict (jucator, masina) do update set bucati = public.garaje.bucati + 1, nivel = greatest(public.garaje.nivel, excluded.nivel);
    insert into public.miscari (jucator, motiv, detalii) values (castig, 'duel pe acte castigat', json_build_object('duel', d.cod, 'masina', m_pierde, 'aveai', avea)::jsonb);
    insert into public.miscari (jucator, motiv, detalii) values (pierde, 'duel pe acte pierdut', json_build_object('duel', d.cod, 'masina', m_pierde)::jsonb);
  end if;
  update public.dueluri set stare = 'incheiat', castigator = castig, incheiat = now() where id = p_duel;
  return json_build_object('castigator', castig);
end;
$$;

revoke all on function public.duel_creeaza(uuid, text, int, text, text, int, int) from public, anon, authenticated;
revoke all on function public.duel_accepta(uuid, uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.duel_incheie(uuid) from public, anon, authenticated;
grant execute on function public.duel_creeaza(uuid, text, int, text, text, int, int) to service_role;
grant execute on function public.duel_accepta(uuid, uuid, text, int, int) to service_role;
grant execute on function public.duel_incheie(uuid) to service_role;
