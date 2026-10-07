-- Economia, pasul 2: dueluri cu miză în Startul, pe bani sau „pe acte" (pierzi
-- mașina). Fiecare aleargă pe telefonul lui, o singură dată; serverul reface ambele
-- curse din apăsări și mută banii sau mașina. Miza se blochează la începutul cursei.
--
-- Stări: pregatit (A și-a blocat miza și aleargă) -> deschis (așteaptă adversar)
-- -> acceptat (B și-a blocat miza și aleargă) -> incheiat. Sau: anulat (A a renunțat
-- ori n-a terminat cursa), expirat (nimeni n-a acceptat în 24 de ore).

alter table public.garaje add column blocat boolean not null default false;

create table public.dueluri (
  id uuid primary key default gen_random_uuid(),
  cod text not null unique,
  tip text not null check (tip in ('bani', 'acte')),
  miza integer not null default 0 check (miza >= 0),
  raritate smallint not null check (raritate between 0 and 4),
  stare text not null default 'pregatit' check (stare in ('pregatit', 'deschis', 'acceptat', 'incheiat', 'anulat', 'expirat')),
  a uuid not null references public.jucatori (id) on delete cascade,
  masina_a text not null,
  timp_a integer,
  apasari_a integer[],
  tur_a integer[],
  b uuid references public.jucatori (id) on delete set null,
  masina_b text,
  timp_b integer,
  apasari_b integer[],
  tur_b integer[],
  castigator uuid,
  termen timestamptz not null,
  creat timestamptz not null default now(),
  incheiat timestamptz
);
create index dueluri_a on public.dueluri (a, creat desc);
create index dueluri_b on public.dueluri (b, creat desc);
create index dueluri_termen on public.dueluri (stare, termen);

alter table public.dueluri enable row level security;
-- fiecare își vede duelurile; restul (după cod) trece prin funcția de pe server
create policy "dueluri: ale tale" on public.dueluri for select to authenticated
  using (a = (select auth.uid()) or b = (select auth.uid()));
grant select on public.dueluri to authenticated;
grant select, insert, update, delete on public.dueluri to service_role;

-- Comisionul casei la duelurile pe bani: 10% din pot, ca banii să și iasă din joc.
create or replace function public.duel_comision(p_miza int) returns int
language sql immutable set search_path = '' as $$ select floor(2 * p_miza * 0.1)::int $$;

-- Blochează miza unui jucător (bani din portofel sau mașina din garaj).
create or replace function public.duel_blocheaza(p_jucator uuid, p_tip text, p_miza int, p_masina text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  p public.portofele;
  g public.garaje;
begin
  select * into g from public.garaje where jucator = p_jucator and masina = p_masina for update;
  if not found then return 'masina'; end if;
  if p_tip = 'bani' then
    select * into p from public.portofele where jucator = p_jucator for update;
    if not found or p.mil < p_miza then return 'bani'; end if;
    update public.portofele set mil = mil - p_miza, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv) values (p_jucator, -p_miza, 'miza duel');
  else
    if g.blocat then return 'blocata'; end if;
    update public.garaje set blocat = true where jucator = p_jucator and masina = p_masina;
  end if;
  return null;
end;
$$;

-- Dă înapoi miza (opțional minus o taxă de abandon).
create or replace function public.duel_elibereaza(p_jucator uuid, p_tip text, p_miza int, p_masina text, p_taxa int, p_motiv text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_tip = 'bani' then
    update public.portofele set mil = mil + greatest(p_miza - p_taxa, 0), actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv) values (p_jucator, greatest(p_miza - p_taxa, 0), p_motiv);
  else
    update public.garaje set blocat = false where jucator = p_jucator and masina = p_masina;
    if p_taxa > 0 then
      update public.portofele set mil = greatest(mil - p_taxa, 0), actualizat = now() where jucator = p_jucator;
      insert into public.miscari (jucator, mil, motiv) values (p_jucator, -p_taxa, p_motiv);
    end if;
  end if;
end;
$$;

-- Duelul se termină: câștigă timpul mai mic; la egalitate fiecare își ia miza înapoi.
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
  -- fără timp de la B (n-a terminat la vreme): câștigă A
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
    -- câștigătorul își ia mașina înapoi și o primește pe a celuilalt
    update public.garaje set blocat = false where jucator = castig and masina = m_castig;
    select raritate into rar from public.garaje where jucator = pierde and masina = m_pierde;
    update public.garaje set bucati = bucati - 1, blocat = false where jucator = pierde and masina = m_pierde and bucati > 1;
    if not found then delete from public.garaje where jucator = pierde and masina = m_pierde; end if;
    avea := exists (select 1 from public.garaje where jucator = castig and masina = m_pierde);
    insert into public.garaje (jucator, masina, raritate) values (castig, m_pierde, rar)
    on conflict (jucator, masina) do update set bucati = public.garaje.bucati + 1;
    insert into public.miscari (jucator, motiv, detalii) values (castig, 'duel pe acte castigat', json_build_object('duel', d.cod, 'masina', m_pierde, 'aveai', avea)::jsonb);
    insert into public.miscari (jucator, motiv, detalii) values (pierde, 'duel pe acte pierdut', json_build_object('duel', d.cod, 'masina', m_pierde)::jsonb);
  end if;
  update public.dueluri set stare = 'incheiat', castigator = castig, incheiat = now() where id = p_duel;
  return json_build_object('castigator', castig);
end;
$$;

-- Duelurile cu termenul trecut: A n-a terminat cursa (anulat, cu taxă), nimeni n-a
-- acceptat (expirat, fără taxă), B n-a terminat cursa (pierde B).
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
      perform public.duel_elibereaza(d.a, d.tip, d.miza, d.masina_a,
        case when d.tip = 'bani' then greatest(1, floor(d.miza * 0.1)::int) else 1 end, 'duel abandonat');
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

revoke all on function public.duel_comision(int) from public, anon, authenticated;
revoke all on function public.duel_blocheaza(uuid, text, int, text) from public, anon, authenticated;
revoke all on function public.duel_elibereaza(uuid, text, int, text, int, text) from public, anon, authenticated;
revoke all on function public.duel_incheie(uuid) from public, anon, authenticated;
revoke all on function public.duel_expira() from public, anon, authenticated;
grant execute on function public.duel_comision(int) to service_role;
grant execute on function public.duel_blocheaza(uuid, text, int, text) to service_role;
grant execute on function public.duel_elibereaza(uuid, text, int, text, int, text) to service_role;
grant execute on function public.duel_incheie(uuid) to service_role;
grant execute on function public.duel_expira() to service_role;

-- ---------- pașii duelului, fiecare într-o tranzacție ----------

-- A își blochează miza și pornește cursa (are 15 minute s-o termine).
create or replace function public.duel_creeaza(p_jucator uuid, p_tip text, p_miza int, p_masina text, p_cod text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  rar smallint;
  err text;
  v_id uuid;
begin
  select raritate into rar from public.garaje where jucator = p_jucator and masina = p_masina;
  if not found then return json_build_object('eroare', 'masina'); end if;
  err := public.duel_blocheaza(p_jucator, p_tip, p_miza, p_masina);
  if err is not null then return json_build_object('eroare', err); end if;
  insert into public.dueluri (cod, tip, miza, raritate, a, masina_a, termen)
  values (p_cod, p_tip, case when p_tip = 'bani' then p_miza else 0 end, rar, p_jucator, p_masina, now() + interval '15 minutes')
  returning id into v_id;
  return json_build_object('id', v_id, 'cod', p_cod, 'raritate', rar);
end;
$$;

-- B acceptă: mașină de aceeași raritate, miza blocată, 15 minute pentru cursă.
create or replace function public.duel_accepta(p_duel uuid, p_jucator uuid, p_masina text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
  rar smallint;
  err text;
begin
  select * into d from public.dueluri where id = p_duel for update;
  if not found then return json_build_object('eroare', 'duel'); end if;
  if d.stare <> 'deschis' or d.termen < now() then return json_build_object('eroare', 'stare'); end if;
  if d.a = p_jucator then return json_build_object('eroare', 'al tau'); end if;
  select raritate into rar from public.garaje where jucator = p_jucator and masina = p_masina;
  if not found then return json_build_object('eroare', 'masina'); end if;
  if rar <> d.raritate then return json_build_object('eroare', 'raritate'); end if;
  err := public.duel_blocheaza(p_jucator, d.tip, d.miza, p_masina);
  if err is not null then return json_build_object('eroare', err); end if;
  update public.dueluri set b = p_jucator, masina_b = p_masina, stare = 'acceptat', termen = now() + interval '15 minutes'
  where id = p_duel;
  return json_build_object('ok', true);
end;
$$;

-- Cursa unuia dintre ei (timpul l-a socotit deja funcția de pe server, din apăsări).
-- A: duelul se deschide pentru 24 de ore. B: duelul se încheie.
create or replace function public.duel_cursa(p_duel uuid, p_jucator uuid, p_timp int, p_apasari int[], p_tur int[])
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  d public.dueluri;
begin
  select * into d from public.dueluri where id = p_duel for update;
  if not found then return json_build_object('eroare', 'duel'); end if;
  if d.termen < now() then return json_build_object('eroare', 'termen'); end if;
  if d.stare = 'pregatit' and d.a = p_jucator then
    update public.dueluri set timp_a = p_timp, apasari_a = p_apasari, tur_a = p_tur, stare = 'deschis', termen = now() + interval '24 hours'
    where id = p_duel;
    return json_build_object('deschis', true);
  end if;
  if d.stare = 'acceptat' and d.b = p_jucator then
    update public.dueluri set timp_b = p_timp, apasari_b = p_apasari, tur_b = p_tur where id = p_duel;
    return public.duel_incheie(p_duel);
  end if;
  return json_build_object('eroare', 'stare');
end;
$$;

-- A renunță: înainte să accepte cineva, cu miza înapoi întreagă; în timpul cursei
-- lui, cu taxa de abandon (ca să nu poată reîncerca până iese o cursă bună).
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
    perform public.duel_elibereaza(d.a, d.tip, d.miza, d.masina_a,
      case when d.tip = 'bani' then greatest(1, floor(d.miza * 0.1)::int) else 1 end, 'duel abandonat');
  else
    return json_build_object('eroare', 'stare');
  end if;
  update public.dueluri set stare = 'anulat', incheiat = now() where id = p_duel;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.duel_creeaza(uuid, text, int, text, text) from public, anon, authenticated;
revoke all on function public.duel_accepta(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.duel_cursa(uuid, uuid, int, int[], int[]) from public, anon, authenticated;
revoke all on function public.duel_anuleaza(uuid, uuid) from public, anon, authenticated;
grant execute on function public.duel_creeaza(uuid, text, int, text, text) to service_role;
grant execute on function public.duel_accepta(uuid, uuid, text) to service_role;
grant execute on function public.duel_cursa(uuid, uuid, int, int[], int[]) to service_role;
grant execute on function public.duel_anuleaza(uuid, uuid) to service_role;
