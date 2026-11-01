-- Exemplarele: fiecare mașină din garaj are bucățile ei, fiecare cu tuningul ei. Un
-- exemplar se tunează, se vinde, se pune pe acte și trece la câștigător cu tot cu
-- tuning (până acum câștigătorul primea o copie, iar celui care pierdea îi rămânea
-- nivelul: tuningul se dubla). `garaje` rămâne colecția (o mașină = un rând: câte
-- exemplare ai, nivelul celui mai tunat, dacă unul e blocat într-un duel) și o ține
-- la zi un trigger, din exemplare; nimic nu mai scrie direct în ea.
-- Tot aici: banii au o zecimală (o comună vândută aduce și 0,2 mil.), iar duelurile
-- se potrivesc după scorul mașinii (± un interval), nu doar după clasă.

-- ---------- banii cu o zecimală ----------
alter table public.portofele alter column mil type numeric(12,1);
alter table public.miscari alter column mil type numeric(12,1);

-- ---------- exemplarele ----------
create table public.exemplare (
  id bigint generated always as identity primary key,
  jucator uuid not null references public.jucatori(id) on delete cascade,
  masina text not null,
  raritate smallint not null check (raritate between 0 and 4),
  nivel smallint not null default 0 check (nivel >= 0),
  blocat boolean not null default false,
  obtinut timestamptz not null default now()
);
create index exemplare_jucator_masina on public.exemplare (jucator, masina);
alter table public.exemplare enable row level security;
create policy "exemplare: doar ale tale" on public.exemplare for select using (jucator = auth.uid());

-- cele de acum: primul exemplar ia nivelul și blocarea mașinii, restul sunt netunate
insert into public.exemplare (jucator, masina, raritate, nivel, blocat, obtinut)
select g.jucator, g.masina, g.raritate, case when i = 1 then g.nivel else 0 end, i = 1 and g.blocat, g.obtinut
from public.garaje g cross join lateral generate_series(1, g.bucati) i;

-- nivelul total al unui exemplar (cele patru piese, scrise în baza 6)
create or replace function public.nivel_total(n int)
returns int language sql immutable set search_path = ''
as $$ select n % 6 + (n / 6) % 6 + (n / 36) % 6 + (n / 216) % 6 $$;

-- rândul din garaje al unei mașini, refăcut din exemplare
create or replace function public.garaj_la_zi(p_jucator uuid, p_masina text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  n int;
  rar smallint;
  niv smallint;
  blo boolean;
  cand timestamptz;
begin
  select count(*), max(raritate), bool_or(blocat), min(obtinut) into n, rar, blo, cand
  from public.exemplare where jucator = p_jucator and masina = p_masina;
  if n = 0 then
    delete from public.garaje where jucator = p_jucator and masina = p_masina;
    return;
  end if;
  select nivel into niv from public.exemplare where jucator = p_jucator and masina = p_masina
  order by public.nivel_total(nivel) desc, id limit 1;
  insert into public.garaje (jucator, masina, raritate, nivel, bucati, blocat, obtinut)
  values (p_jucator, p_masina, rar, niv, n, blo, cand)
  on conflict (jucator, masina) do update set bucati = excluded.bucati, nivel = excluded.nivel, blocat = excluded.blocat;
end;
$$;

create or replace function public.exemplare_la_garaj()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then perform public.garaj_la_zi(old.jucator, old.masina); end if;
  -- un exemplar câștigat pe acte schimbă garajul: și pe al celui care îl primește
  if tg_op = 'INSERT' or new.jucator <> old.jucator or new.masina <> old.masina then
    perform public.garaj_la_zi(new.jucator, new.masina);
  end if;
  return null;
end;
$$;
create trigger exemplare_la_garaj after insert or update or delete on public.exemplare
for each row execute function public.exemplare_la_garaj();

-- un exemplar nou în garaj; întoarce câte ai acum din mașina asta
create or replace function public.exemplar_nou(p_jucator uuid, p_masina text, p_raritate int, p_nivel int default 0, out id bigint, out bucati int)
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.exemplare (jucator, masina, raritate, nivel) values (p_jucator, p_masina, p_raritate, p_nivel)
  returning exemplare.id into id;
  select g.bucati into bucati from public.garaje g where g.jucator = p_jucator and g.masina = p_masina;
end;
$$;

-- Startul: echipa ține și exemplarul ales (dacă îl vinzi sau îl pierzi, rămâne mașina)
alter table public.echipe add column exemplar bigint references public.exemplare(id) on delete set null;

-- ---------- lăzile, pachetele, Vitrina, Cupa: exemplare noi ----------
create or replace function public.deschide_lada(p_jucator uuid, p_lada text, p_pret integer, p_gratis boolean, p_masina text, p_raritate integer, p_valoare_dublura integer)
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

create or replace function public.deschide_pachet(p_jucator uuid, p_pachet text, p_pret integer, p_masini text[], p_raritati integer[], p_gratis boolean default false)
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

create or replace function public.cumpara_masina(p_jucator uuid, p_masina text, p_raritate integer, p_pret integer)
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

create or replace function public.plateste_cupa_premii(p_data date, p_premii integer[], p_participare integer, p_masina1 text, p_raritate1 integer, p_masina2 text, p_raritate2 integer)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_cheie text := 'cupa:' || p_data;
  n int;
  x record;
  suma int;
  platiti json[] := '{}';
begin
  if p_data >= (now() at time zone 'Europe/Bucharest')::date then return json_build_object('eroare', 'in curs'); end if;
  insert into public.premii_platite (cheie) values (v_cheie) on conflict do nothing;
  if not found then return json_build_object('deja', true); end if;
  select count(*) into n from public.cupa_inscrieri where data = p_data and timp_ms is not null;
  for x in
    select jucator, row_number() over (order by timp_ms, actualizat) as loc
    from public.cupa_inscrieri where data = p_data and timp_ms is not null
    order by loc
  loop
    suma := p_participare + coalesce(p_premii[x.loc::int], 0);
    perform public.recompensa(x.jucator, suma, 0, case when x.loc <= 3 then 'premiu cupa' else 'cupa' end, v_cheie,
      json_build_object('data', p_data, 'loc', x.loc, 'masina', case x.loc when 1 then p_masina1 when 2 then p_masina2 end)::jsonb);
    if x.loc in (1, 2) then
      perform public.exemplar_nou(x.jucator, case when x.loc = 1 then p_masina1 else p_masina2 end, case when x.loc = 1 then p_raritate1 else p_raritate2 end);
    end if;
    if x.loc <= 3 then platiti := platiti || json_build_object('loc', x.loc, 'mil', suma); end if;
  end loop;
  update public.premii_platite set detalii = json_build_object('alergat', n, 'platiti', platiti)::jsonb where cheie = v_cheie;
  return json_build_object('alergat', n, 'platiti', platiti);
end;
$$;

-- ---------- dublurile și vânzarea ----------
-- O dublură (un exemplar netunat, cât timp mai rămâne cel puțin unul): pe bani sau pe
-- un punct de upgrade. Valoarea o dă serverul (prețul mașinii).
drop function if exists public.dublura_schimba(uuid, text, text, integer, integer);
create function public.dublura_schimba(p_jucator uuid, p_masina text, p_alegere text, p_raritate integer, p_valoare numeric)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  ex bigint;
  p public.portofele;
  n int;
begin
  if p_alegere not in ('vinde', 'puncte') or p_raritate not between 0 and 4 then return json_build_object('eroare', 'alegere'); end if;
  perform 1 from public.garaje where jucator = p_jucator and masina = p_masina for update;
  select count(*) into n from public.exemplare where jucator = p_jucator and masina = p_masina;
  if n < 2 then return json_build_object('eroare', 'fara dublura'); end if;
  select id into ex from public.exemplare where jucator = p_jucator and masina = p_masina and nivel = 0 and not blocat
  order by id desc limit 1 for update;
  if not found then return json_build_object('eroare', 'fara dublura'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'portofel'); end if;
  delete from public.exemplare where id = ex;
  if p_alegere = 'vinde' then
    update public.portofele set mil = mil + greatest(p_valoare, 0), actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, greatest(p_valoare, 0), 'dublura vanduta', json_build_object('masina', p_masina)::jsonb);
  else
    update public.portofele set puncte[p_raritate + 1] = puncte[p_raritate + 1] + 1, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, 0, 'dublura puncte', json_build_object('masina', p_masina, 'raritate', p_raritate)::jsonb);
  end if;
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('mil', p.mil, 'puncte', p.puncte, 'bucati', n - 1);
end;
$$;

-- Un exemplar anume, vândut (și ultimul: mașina iese din colecție; seturile plătite
-- rămân plătite). Prețul îl socotește serverul: mașina plus jumătate din tuning.
create or replace function public.vinde_exemplar(p_jucator uuid, p_exemplar bigint, p_nivel integer, p_valoare numeric)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  e public.exemplare;
  p public.portofele;
  n int;
begin
  select * into e from public.exemplare where id = p_exemplar and jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'exemplar'); end if;
  if e.blocat then return json_build_object('eroare', 'blocata'); end if;
  if e.nivel <> p_nivel then return json_build_object('eroare', 'nivel'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'portofel'); end if;
  delete from public.exemplare where id = e.id;
  update public.portofele set mil = mil + greatest(p_valoare, 0), actualizat = now() where jucator = p_jucator;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, greatest(p_valoare, 0), 'masina vanduta', json_build_object('masina', e.masina, 'nivel', e.nivel)::jsonb);
  select count(*) into n from public.exemplare where jucator = p_jucator and masina = e.masina;
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('mil', p.mil, 'bucati', n);
end;
$$;

-- ---------- tuningul, pe un exemplar ----------
drop function if exists public.tuneaza(uuid, text, integer, integer);
drop function if exists public.tuneaza_puncte(uuid, text, integer, integer, integer);
drop function if exists public.tuneaza_piesa(uuid, text, integer, integer, integer);
drop function if exists public.tuneaza_piesa_mil(uuid, text, integer, integer);

create function public.tuneaza_piesa(p_jucator uuid, p_exemplar bigint, p_piesa integer, p_raritate integer, p_cost integer)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
  e public.exemplare;
  pas int;
  acum int;
begin
  if p_piesa not between 0 and 3 or p_raritate not between 0 and 4 or p_cost < 1 then return json_build_object('eroare', 'tuning'); end if;
  pas := power(6, p_piesa)::int;
  select * into e from public.exemplare where id = p_exemplar and jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if e.blocat then return json_build_object('eroare', 'blocata'); end if;
  acum := (e.nivel / pas) % 6;
  if acum >= 5 then return json_build_object('eroare', 'maxim'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found or p.puncte[p_raritate + 1] < p_cost then return json_build_object('eroare', 'puncte'); end if;
  update public.portofele set puncte[p_raritate + 1] = puncte[p_raritate + 1] - p_cost, actualizat = now() where jucator = p_jucator;
  update public.exemplare set nivel = nivel + pas where id = e.id;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, 0, 'tuning', json_build_object('masina', e.masina, 'exemplar', e.id, 'piesa', p_piesa, 'nivel', acum + 1, 'puncte', p_cost)::jsonb);
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('exemplar', e.id, 'nivel', e.nivel + pas, 'mil', p.mil, 'puncte', p.puncte);
end;
$$;

create function public.tuneaza_piesa_mil(p_jucator uuid, p_exemplar bigint, p_piesa integer, p_cost integer)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
  e public.exemplare;
  pas int;
  acum int;
begin
  if p_piesa not between 0 and 3 or p_cost < 1 then return json_build_object('eroare', 'tuning'); end if;
  pas := power(6, p_piesa)::int;
  select * into e from public.exemplare where id = p_exemplar and jucator = p_jucator for update;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if e.blocat then return json_build_object('eroare', 'blocata'); end if;
  acum := (e.nivel / pas) % 6;
  if acum >= 5 then return json_build_object('eroare', 'maxim'); end if;
  select * into p from public.portofele where jucator = p_jucator for update;
  if not found or p.mil < p_cost then return json_build_object('eroare', 'bani'); end if;
  update public.portofele set mil = mil - p_cost, actualizat = now() where jucator = p_jucator;
  update public.exemplare set nivel = nivel + pas where id = e.id;
  insert into public.miscari (jucator, mil, motiv, detalii)
  values (p_jucator, -p_cost, 'tuning', json_build_object('masina', e.masina, 'exemplar', e.id, 'piesa', p_piesa, 'nivel', acum + 1)::jsonb);
  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('exemplar', e.id, 'nivel', e.nivel + pas, 'mil', p.mil, 'puncte', p.puncte);
end;
$$;

-- ---------- duelurile: un exemplar anume, potrivire după scor ----------
alter table public.dueluri add column ex_a bigint, add column ex_b bigint, add column scor_a smallint, add column scor_b smallint;

drop function if exists public.duel_rapid(uuid, integer, text, integer, integer, text);
drop function if exists public.duel_accepta(uuid, uuid, text, integer, integer);
drop function if exists public.duel_creeaza(uuid, text, integer, text, text, integer, integer);
drop function if exists public.duel_blocheaza(uuid, text, integer, text);
drop function if exists public.duel_elibereaza(uuid, text, integer, text, integer, text);

-- Miza: banii (pe bani) sau exemplarul (pe acte), blocat până se termină duelul.
create function public.duel_blocheaza(p_jucator uuid, p_tip text, p_miza integer, p_exemplar bigint)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
  e public.exemplare;
begin
  select * into e from public.exemplare where id = p_exemplar and jucator = p_jucator for update;
  if not found then return 'masina'; end if;
  if p_tip = 'bani' then
    select * into p from public.portofele where jucator = p_jucator for update;
    if not found or p.mil < p_miza then return 'bani'; end if;
    update public.portofele set mil = mil - p_miza, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv) values (p_jucator, -p_miza, 'miza duel');
  else
    if e.blocat then return 'blocata'; end if;
    update public.exemplare set blocat = true where id = e.id;
  end if;
  return null;
end;
$$;

create function public.duel_elibereaza(p_jucator uuid, p_tip text, p_miza integer, p_exemplar bigint, p_taxa integer, p_motiv text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_tip = 'bani' then
    update public.portofele set mil = mil + greatest(p_miza - p_taxa, 0), actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv) values (p_jucator, greatest(p_miza - p_taxa, 0), p_motiv);
  else
    update public.exemplare set blocat = false where id = p_exemplar and jucator = p_jucator;
    if p_taxa > 0 then
      update public.portofele set mil = greatest(mil - p_taxa, 0), actualizat = now() where jucator = p_jucator;
      insert into public.miscari (jucator, mil, motiv) values (p_jucator, -p_taxa, p_motiv);
    end if;
  end if;
end;
$$;

-- `p_nivel`: nivelul cu care serverul a socotit clasa și scorul (dacă între timp
-- exemplarul s-a tunat, cererea nu mai e bună)
create function public.duel_creeaza(p_jucator uuid, p_tip text, p_miza integer, p_exemplar bigint, p_nivel integer, p_cod text, p_clasa integer, p_scor integer)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  e public.exemplare;
  err text;
  v_id uuid;
begin
  select * into e from public.exemplare where id = p_exemplar and jucator = p_jucator;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if e.nivel <> p_nivel then return json_build_object('eroare', 'nivel'); end if;
  err := public.duel_blocheaza(p_jucator, p_tip, p_miza, p_exemplar);
  if err is not null then return json_build_object('eroare', err); end if;
  insert into public.dueluri (cod, tip, miza, raritate, a, masina_a, nivel_a, ex_a, scor_a, termen)
  values (p_cod, p_tip, case when p_tip = 'bani' then p_miza else 0 end, p_clasa, p_jucator, e.masina, p_nivel, e.id, p_scor, now() + interval '15 minutes')
  returning id into v_id;
  return json_build_object('id', v_id, 'cod', p_cod, 'clasa', p_clasa, 'scor', p_scor);
end;
$$;

create function public.duel_accepta(p_duel uuid, p_jucator uuid, p_exemplar bigint, p_nivel integer, p_clasa integer, p_scor integer, p_interval integer)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
  e public.exemplare;
  err text;
begin
  select * into d from public.dueluri where id = p_duel for update;
  if not found then return json_build_object('eroare', 'duel'); end if;
  if d.stare <> 'deschis' or d.termen < now() then return json_build_object('eroare', 'stare'); end if;
  if d.a = p_jucator then return json_build_object('eroare', 'al tau'); end if;
  select * into e from public.exemplare where id = p_exemplar and jucator = p_jucator;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if e.nivel <> p_nivel then return json_build_object('eroare', 'nivel'); end if;
  if (d.scor_a is null and p_clasa <> d.raritate) or abs(coalesce(d.scor_a, p_scor) - p_scor) > p_interval then
    return json_build_object('eroare', 'raritate');
  end if;
  err := public.duel_blocheaza(p_jucator, d.tip, d.miza, p_exemplar);
  if err is not null then return json_build_object('eroare', err); end if;
  update public.dueluri set b = p_jucator, masina_b = e.masina, nivel_b = p_nivel, ex_b = e.id, scor_b = p_scor,
    stare = 'acceptat', termen = now() + interval '15 minutes'
  where id = p_duel;
  return json_build_object('ok', true);
end;
$$;

-- Duelul rapid: adversarul cel mai apropiat ca scor (în interval), apoi cel mai vechi.
create function public.duel_rapid(p_jucator uuid, p_miza integer, p_exemplar bigint, p_nivel integer, p_clasa integer, p_scor integer, p_interval integer, p_cod text)
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
    and abs(coalesce(d.scor_a, -1000) - p_scor) <= p_interval and d.miza = p_miza and d.a <> p_jucator
    and not exists (
      select 1 from public.dueluri x
      where x.rapid and x.creat > now() - interval '24 hours'
        and ((x.a = d.a and x.b = p_jucator) or (x.a = p_jucator and x.b = d.a))
    )
  order by abs(d.scor_a - p_scor), d.creat
  limit 1
  for update skip locked;
  if found then
    r := public.duel_accepta(v_id, p_jucator, p_exemplar, p_nivel, p_clasa, p_scor, p_interval);
    if r->>'eroare' is not null then return r; end if;
    return json_build_object('rol', 'b', 'id', v_id);
  end if;
  r := public.duel_creeaza(p_jucator, 'bani', p_miza, p_exemplar, p_nivel, p_cod, p_clasa, p_scor);
  if r->>'eroare' is not null then return r; end if;
  update public.dueluri set rapid = true where id = (r->>'id')::uuid;
  return json_build_object('rol', 'a', 'id', r->>'id', 'cod', p_cod);
end;
$$;

create or replace function public.duel_expira()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
  n int := 0;
begin
  for d in select * from public.dueluri where stare in ('pregatit', 'deschis', 'acceptat') and termen < now() for update skip locked loop
    if d.stare = 'pregatit' then
      perform public.duel_elibereaza(d.a, d.tip, d.miza, d.ex_a, public.duel_taxa_abandon(d), 'duel abandonat');
      update public.dueluri set stare = 'anulat', incheiat = now() where id = d.id;
    elsif d.stare = 'deschis' then
      perform public.duel_elibereaza(d.a, d.tip, d.miza, d.ex_a, 0, 'duel neacceptat');
      update public.dueluri set stare = 'expirat', incheiat = now() where id = d.id;
    else
      perform public.duel_incheie(d.id);
    end if;
    n := n + 1;
  end loop;
  return n;
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
    perform public.duel_elibereaza(d.a, d.tip, d.miza, d.ex_a, 0, 'duel anulat');
  elsif d.stare = 'pregatit' then
    perform public.duel_elibereaza(d.a, d.tip, d.miza, d.ex_a, public.duel_taxa_abandon(d), 'duel abandonat');
  else
    return json_build_object('eroare', 'stare');
  end if;
  update public.dueluri set stare = 'anulat', incheiat = now() where id = p_duel;
  return json_build_object('ok', true);
end;
$$;

-- Încheierea: pe acte, exemplarul celui care pierde trece la câștigător, cu tot cu
-- tuning; celui care pierde nu-i rămâne nimic din el.
create or replace function public.duel_incheie(p_duel uuid)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
  castig uuid;
  pierde uuid;
  ex_castig bigint;
  ex_pierde bigint;
  m_pierde text;
  premiu int;
  avea boolean;
begin
  select * into d from public.dueluri where id = p_duel for update;
  if d.stare <> 'acceptat' then return json_build_object('eroare', 'stare'); end if;
  if d.timp_b is not null and d.timp_a = d.timp_b then
    perform public.duel_elibereaza(d.a, d.tip, d.miza, d.ex_a, 0, 'duel egal');
    perform public.duel_elibereaza(d.b, d.tip, d.miza, d.ex_b, 0, 'duel egal');
    update public.dueluri set stare = 'incheiat', incheiat = now() where id = p_duel;
    return json_build_object('egal', true);
  end if;
  if d.timp_b is null or d.timp_a < d.timp_b then
    castig := d.a; pierde := d.b; ex_castig := d.ex_a; ex_pierde := d.ex_b; m_pierde := d.masina_b;
  else
    castig := d.b; pierde := d.a; ex_castig := d.ex_b; ex_pierde := d.ex_a; m_pierde := d.masina_a;
  end if;
  if d.tip = 'bani' then
    premiu := 2 * d.miza - public.duel_comision(d.miza);
    update public.portofele set mil = mil + premiu, actualizat = now() where jucator = castig;
    insert into public.miscari (jucator, mil, motiv, detalii) values (castig, premiu, 'duel castigat', json_build_object('duel', d.cod)::jsonb);
  else
    update public.exemplare set blocat = false where id = ex_castig;
    avea := exists (select 1 from public.garaje where jucator = castig and masina = m_pierde);
    update public.exemplare set jucator = castig, blocat = false where id = ex_pierde and jucator = pierde;
    insert into public.miscari (jucator, motiv, detalii) values (castig, 'duel pe acte castigat', json_build_object('duel', d.cod, 'masina', m_pierde, 'aveai', avea, 'nivel', case when castig = d.a then d.nivel_b else d.nivel_a end)::jsonb);
    insert into public.miscari (jucator, motiv, detalii) values (pierde, 'duel pe acte pierdut', json_build_object('duel', d.cod, 'masina', m_pierde)::jsonb);
  end if;
  update public.dueluri set stare = 'incheiat', castigator = castig, incheiat = now() where id = p_duel;
  return json_build_object('castigator', castig);
end;
$$;

-- doar serverul (funcțiile) le cheamă
revoke all on function public.nivel_total(int) from public, anon, authenticated;
revoke all on function public.garaj_la_zi(uuid, text) from public, anon, authenticated;
revoke all on function public.exemplare_la_garaj() from public, anon, authenticated;
revoke all on function public.exemplar_nou(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.deschide_lada(uuid, text, integer, boolean, text, integer, integer) from public, anon, authenticated;
revoke all on function public.deschide_pachet(uuid, text, integer, text[], integer[], boolean) from public, anon, authenticated;
revoke all on function public.cumpara_masina(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.plateste_cupa_premii(date, integer[], integer, text, integer, text, integer) from public, anon, authenticated;
revoke all on function public.dublura_schimba(uuid, text, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.vinde_exemplar(uuid, bigint, integer, numeric) from public, anon, authenticated;
revoke all on function public.tuneaza_piesa(uuid, bigint, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.tuneaza_piesa_mil(uuid, bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.duel_blocheaza(uuid, text, integer, bigint) from public, anon, authenticated;
revoke all on function public.duel_elibereaza(uuid, text, integer, bigint, integer, text) from public, anon, authenticated;
revoke all on function public.duel_creeaza(uuid, text, integer, bigint, integer, text, integer, integer) from public, anon, authenticated;
revoke all on function public.duel_accepta(uuid, uuid, bigint, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.duel_rapid(uuid, integer, bigint, integer, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.duel_expira() from public, anon, authenticated;
revoke all on function public.duel_anuleaza(uuid, uuid) from public, anon, authenticated;
revoke all on function public.duel_incheie(uuid) from public, anon, authenticated;
