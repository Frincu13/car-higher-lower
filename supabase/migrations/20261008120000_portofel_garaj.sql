-- Economia, pasul 1: portofelul (mil.), garajul (colecția de mașini) și istoricul
-- fiecărei mișcări de bani. Clienții își pot citi doar rândurile lor; banii și
-- mașinile le mută numai funcțiile de mai jos, chemate de funcțiile de pe server
-- (rolul service_role), fiecare dintr-o singură tranzacție.

create table public.portofele (
  jucator uuid primary key references public.jucatori (id) on delete cascade,
  mil integer not null default 0 check (mil >= 0),
  lazi_gratis integer not null default 0 check (lazi_gratis >= 0),
  serie integer not null default 0,
  ultima_zi date,
  actualizat timestamptz not null default now()
);

-- O mașină o dată pe jucător; `bucati` numără câte au ieșit din lăzi (dublurile se
-- vând pe loc). `nivel` e pentru tuning, mai târziu.
create table public.garaje (
  jucator uuid not null references public.jucatori (id) on delete cascade,
  masina text not null,
  raritate smallint not null check (raritate between 0 and 4),
  nivel smallint not null default 0 check (nivel >= 0),
  bucati integer not null default 1 check (bucati >= 1),
  obtinut timestamptz not null default now(),
  primary key (jucator, masina)
);

-- Fiecare mișcare de bani sau de lăzi gratis. `cheie` face ca o recompensă să se
-- dea o singură dată (de pildă 'zi:ordine:2026-10-08').
create table public.miscari (
  id bigint generated always as identity primary key,
  jucator uuid not null references public.jucatori (id) on delete cascade,
  mil integer not null default 0,
  lazi integer not null default 0,
  motiv text not null,
  cheie text,
  detalii jsonb,
  creat timestamptz not null default now(),
  unique (jucator, cheie)
);
create index miscari_jucator on public.miscari (jucator, creat desc);

alter table public.portofele enable row level security;
alter table public.garaje enable row level security;
alter table public.miscari enable row level security;
create policy "portofele: doar al tau" on public.portofele for select to authenticated using (jucator = (select auth.uid()));
create policy "garaje: doar al tau" on public.garaje for select to authenticated using (jucator = (select auth.uid()));
create policy "miscari: doar ale tale" on public.miscari for select to authenticated using (jucator = (select auth.uid()));
grant select on public.portofele, public.garaje, public.miscari to authenticated;
grant select, insert, update, delete on public.portofele, public.garaje, public.miscari to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Portofelul există; la prima creare vine bonusul de bun venit. Întoarce starea.
create or replace function public.asigura_portofel(p_jucator uuid, p_mil int, p_lazi int)
returns public.portofele
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.portofele;
begin
  insert into public.portofele (jucator, mil, lazi_gratis) values (p_jucator, p_mil, p_lazi)
  on conflict (jucator) do nothing;
  if found then
    insert into public.miscari (jucator, mil, lazi, motiv, cheie) values (p_jucator, p_mil, p_lazi, 'bun venit', 'bun-venit');
  end if;
  select * into r from public.portofele where jucator = p_jucator;
  return r;
end;
$$;

-- O recompensă dată o singură dată pe cheie. Întoarce true dacă s-a dat acum.
create or replace function public.recompensa(p_jucator uuid, p_mil int, p_lazi int, p_motiv text, p_cheie text, p_detalii jsonb default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.miscari (jucator, mil, lazi, motiv, cheie, detalii)
  values (p_jucator, p_mil, p_lazi, p_motiv, p_cheie, p_detalii)
  on conflict (jucator, cheie) do nothing;
  if not found then return false; end if;
  update public.portofele set mil = mil + p_mil, lazi_gratis = lazi_gratis + p_lazi, actualizat = now()
  where jucator = p_jucator;
  return true;
end;
$$;

-- Seria de zile: prima provocare a zilei o mărește (sau o ia de la 1). Întoarce
-- seria de azi și dacă a fost prima provocare a zilei.
create or replace function public.noteaza_zi(p_jucator uuid, p_data date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.portofele;
begin
  select * into p from public.portofele where jucator = p_jucator for update;
  if p.ultima_zi is not distinct from p_data then
    return json_build_object('serie', p.serie, 'prima', false);
  end if;
  if p.ultima_zi is not null and p_data < p.ultima_zi then
    return json_build_object('serie', p.serie, 'prima', false);
  end if;
  update public.portofele
     set serie = case when p.ultima_zi = p_data - 1 then p.serie + 1 else 1 end,
         ultima_zi = p_data, actualizat = now()
   where jucator = p_jucator
  returning serie into p.serie;
  return json_build_object('serie', p.serie, 'prima', true);
end;
$$;

-- O ladă: plătită (mil.) sau gratis. Mașina nouă intră în garaj; una pe care o ai
-- deja se vinde pe loc cu valoarea dublurii. Totul sau nimic.
create or replace function public.deschide_lada(
  p_jucator uuid, p_lada text, p_pret int, p_gratis boolean,
  p_masina text, p_raritate int, p_valoare_dublura int
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.portofele;
  noua boolean;
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

  insert into public.garaje (jucator, masina, raritate) values (p_jucator, p_masina, p_raritate)
  on conflict (jucator, masina) do update set bucati = public.garaje.bucati + 1;
  noua := (select bucati = 1 from public.garaje where jucator = p_jucator and masina = p_masina);
  if not noua then
    update public.portofele set mil = mil + p_valoare_dublura, actualizat = now() where jucator = p_jucator;
    insert into public.miscari (jucator, mil, motiv, detalii) values (p_jucator, p_valoare_dublura, 'dublura vanduta', json_build_object('masina', p_masina)::jsonb);
  end if;

  select * into p from public.portofele where jucator = p_jucator;
  return json_build_object('noua', noua, 'mil', p.mil, 'lazi_gratis', p.lazi_gratis);
end;
$$;

revoke all on function public.asigura_portofel(uuid, int, int) from public, anon, authenticated;
revoke all on function public.recompensa(uuid, int, int, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.noteaza_zi(uuid, date) from public, anon, authenticated;
revoke all on function public.deschide_lada(uuid, text, int, boolean, text, int, int) from public, anon, authenticated;
grant execute on function public.asigura_portofel(uuid, int, int) to service_role;
grant execute on function public.recompensa(uuid, int, int, text, text, jsonb) to service_role;
grant execute on function public.noteaza_zi(uuid, date) to service_role;
grant execute on function public.deschide_lada(uuid, text, int, boolean, text, int, int) to service_role;
