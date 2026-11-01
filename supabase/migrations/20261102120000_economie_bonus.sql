-- Economia din 2026-11-02: lăzile, pachetele și Vitrina costă ×1,5 (prețuri cu o
-- zecimală, ca 1,5 mil.), iar după plafonul zilei partidele umplu lăzile de bonus
-- (Bronz, Argint, Aur), câte o dată pe zi fiecare.

-- ---------- prețuri cu zecimală ----------
drop function if exists public.deschide_lada(uuid, text, integer, boolean, text, integer, integer);
drop function if exists public.deschide_pachet(uuid, text, integer, text[], integer[], boolean);
drop function if exists public.cumpara_masina(uuid, text, integer, integer);

create function public.deschide_lada(p_jucator uuid, p_lada text, p_pret numeric, p_gratis boolean, p_masina text, p_raritate integer, p_valoare_dublura numeric)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
  e record;
begin
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'portofel'); end if;
  if p_gratis then
    if p.lazi_gratis < 1 then return json_build_object('eroare', 'fara lazi gratis'); end if;
    update public.portofele set lazi_gratis = lazi_gratis - 1, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, lazi, motiv, detalii) values (p_jucator, -1, 'lada gratis', json_build_object('lada', p_lada)::jsonb);
  else
    if p.mil < p_pret then return json_build_object('eroare', 'bani'); end if;
    update public.portofele set mil = mil - p_pret, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, -p_pret, 'lada', json_build_object('lada', p_lada)::jsonb);
  end if;
  select * into e from public.exemplar_nou(p_jucator, p_masina, p_raritate);
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('noua', e.bucati = 1, 'bucati', e.bucati, 'exemplar', e.id, 'mil', p.mil, 'lazi_gratis', p.lazi_gratis, 'puncte', p.puncte);
end;
$$;

create function public.deschide_pachet(p_jucator uuid, p_pachet text, p_pret numeric, p_masini text[], p_raritati integer[], p_gratis boolean default false)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
  e record;
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
    select * into e from public.exemplar_nou(p_jucator, p_masini[i], p_raritati[i]);
    rez := rez || json_build_object('noua', e.bucati = 1, 'bucati', e.bucati, 'exemplar', e.id);
  end loop;
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('carti', array_to_json(rez), 'mil', p.mil, 'lazi_gratis', p.lazi_gratis, 'pachete_gratis', p.pachete_gratis, 'puncte', p.puncte);
end;
$$;

create function public.cumpara_masina(p_jucator uuid, p_masina text, p_raritate integer, p_pret numeric)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
begin
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'portofel'); end if;
  if exists (select 1 from public.garaje where jucator = p_jucator and masina = p_masina) then
    return json_build_object('eroare', 'o ai');
  end if;
  if p.mil < p_pret then return json_build_object('eroare', 'bani'); end if;
  update public.portofele set mil = mil - p_pret, actualizat = now() where jucator = p_jucator;
  perform public.exemplar_nou(p_jucator, p_masina, p_raritate);
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, -p_pret, 'vitrina', json_build_object('masina', p_masina)::jsonb);
  return json_build_object('mil', p.mil - p_pret);
end;
$$;

-- ---------- lăzile de bonus ----------
-- Pe zi: cât s-a strâns peste plafon, câte trepte ai atins și câte ai deschis.
create table public.bonus_zi (
  jucator uuid not null references public.jucatori(id) on delete cascade,
  data date not null,
  strans numeric(8,1) not null default 0,
  castigate smallint not null default 0,
  deschise smallint not null default 0,
  primary key (jucator, data)
);
alter table public.bonus_zi enable row level security;
create policy "bonus_zi: doar al tau" on public.bonus_zi for select using (jucator = auth.uid());
grant select, insert, update, delete on public.bonus_zi to service_role;
grant select on public.bonus_zi to authenticated;

-- Banii din joc, cu plafonul zilei. Ce trece de plafon (o singură dată pe partidă, după
-- cheie) se strânge pentru lăzile de bonus; `p_praguri` sunt Economie.BONUS.praguri.
drop function if exists public.castig_joc(uuid, integer, integer, text, text, date);
create function public.castig_joc(p_jucator uuid, p_mil integer, p_plafon integer, p_motiv text, p_cheie text, p_data date, p_praguri numeric[] default '{15,45,105}')
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  luat numeric;
  dat int;
  peste int;
  s numeric;
begin
  if p_mil is null or p_mil <= 0 or p_motiv not in ('partida', 'victorie') then return 0; end if;
  perform 1 from public.portofele where jucator = p_jucator for update;
  if not found then return 0; end if;
  select coalesce(sum(mil), 0) into luat from public.miscari
   where jucator = p_jucator and motiv in ('partida', 'victorie') and detalii ->> 'zi' = p_data::text;
  dat := least(p_mil, greatest(0, p_plafon - luat))::int;
  peste := p_mil - dat;
  -- rândul se scrie și când plafonul e atins (0 mil.), ca partida să umple bara o dată
  insert into public.miscari (jucator, mil, motiv, cheie, detalii)
  values (p_jucator, dat, p_motiv, p_cheie, jsonb_build_object('zi', p_data::text, 'peste', peste))
  on conflict (jucator, cheie) do nothing;
  if not found then return 0; end if;
  if dat > 0 then
    update public.portofele set mil = mil + dat, actualizat = now() where jucator = p_jucator;
  end if;
  if peste > 0 then
    -- strâns crește și după Aur (pagina vede așa că nu e o treaptă nouă); treptele rămân trei
    insert into public.bonus_zi (jucator, data, strans) values (p_jucator, p_data, peste)
    on conflict (jucator, data) do update set strans = public.bonus_zi.strans + peste
    returning strans into s;
    update public.bonus_zi set castigate = (select count(*) from unnest(p_praguri) x where x <= s)
    where jucator = p_jucator and data = p_data;
  end if;
  return dat;
end;
$$;

-- Deschide următoarea ladă de bonus (cea mai veche nedeschisă). Premiul îl trage
-- serverul (portofel) pentru `p_treapta`; aici se verifică treapta și se dă, totul o dată.
--   p_tip: 'puncte' (p_n puncte de raritatea p_raritate) | 'lada' (o ladă Stradă gratis) |
--          'pachet' (un Pachet Sport gratis) | 'masina' (p_masina, de raritatea p_raritate)
create function public.bonus_deschide(p_jucator uuid, p_data date, p_treapta integer, p_tip text, p_raritate integer, p_n integer, p_masina text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  b public.bonus_zi;
  e record;
  v_ex bigint;
  v_bucati int;
  p public.portofele;
begin
  select * into b from public.bonus_zi where jucator = p_jucator and data = p_data for update;
  if not found or b.deschise >= b.castigate then return json_build_object('eroare', 'fara lada'); end if;
  if b.deschise <> p_treapta then return json_build_object('eroare', 'treapta'); end if;
  if p_tip = 'puncte' then
    if p_raritate not between 0 and 4 or p_n not between 1 and 10 then return json_build_object('eroare', 'premiu'); end if;
    update public.portofele set puncte[p_raritate + 1] = puncte[p_raritate + 1] + p_n, actualizat = now() where jucator = p_jucator;
  elsif p_tip = 'lada' then
    update public.portofele set lazi_gratis = lazi_gratis + 1, actualizat = now() where jucator = p_jucator;
  elsif p_tip = 'pachet' then
    update public.portofele set pachete_gratis = pachete_gratis + 1, actualizat = now() where jucator = p_jucator;
  elsif p_tip = 'masina' then
    if p_masina is null or p_raritate not between 0 and 4 then return json_build_object('eroare', 'premiu'); end if;
    select * into e from public.exemplar_nou(p_jucator, p_masina, p_raritate);
    v_ex := e.id; v_bucati := e.bucati;
  else
    return json_build_object('eroare', 'premiu');
  end if;
  update public.bonus_zi set deschise = deschise + 1 where jucator = p_jucator and data = p_data;
  insert into public.miscari (jucator, mil, lazi, motiv, detalii)
  values (p_jucator, 0, case when p_tip = 'lada' then 1 else 0 end, 'lada bonus',
    jsonb_build_object('treapta', p_treapta, 'tip', p_tip, 'raritate', p_raritate, 'n', p_n, 'masina', p_masina, 'zi', p_data::text));
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('ok', true, 'noua', v_bucati = 1, 'bucati', v_bucati, 'exemplar', v_ex,
    'mil', p.mil, 'puncte', p.puncte, 'lazi_gratis', p.lazi_gratis, 'pachete_gratis', p.pachete_gratis);
end;
$$;

-- doar serverul le cheamă
revoke all on function public.deschide_lada(uuid, text, numeric, boolean, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.deschide_pachet(uuid, text, numeric, text[], integer[], boolean) from public, anon, authenticated;
revoke all on function public.cumpara_masina(uuid, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.castig_joc(uuid, integer, integer, text, text, date, numeric[]) from public, anon, authenticated;
revoke all on function public.bonus_deschide(uuid, date, integer, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.deschide_lada(uuid, text, numeric, boolean, text, integer, numeric) to service_role;
grant execute on function public.deschide_pachet(uuid, text, numeric, text[], integer[], boolean) to service_role;
grant execute on function public.cumpara_masina(uuid, text, integer, numeric) to service_role;
grant execute on function public.castig_joc(uuid, integer, integer, text, text, date, numeric[]) to service_role;
grant execute on function public.bonus_deschide(uuid, date, integer, text, integer, integer, text) to service_role;
