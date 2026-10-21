-- Numele nepotrivite din clasamente. Oricine poate raporta un nume; unul raportat de 3
-- jucători cu cont legat de mail (sau ascuns de mână, cu tools/nume.mjs) intră în lista
-- celor interzise, iar toți cei care îl poartă revin la numele de început („Jucător
-- ABCD"). Problema e numele, nu omul: nu se șterge nimic altceva.
create table public.nume_raportari (
  nume text not null,
  de uuid not null references auth.users (id) on delete cascade,
  legat boolean not null default false,   -- doar rapoartele din conturi legate se numără
  creat timestamptz not null default now(),
  primary key (nume, de)
);
create index nume_raportari_creat on public.nume_raportari (creat);

create table public.nume_interzise (
  nume text primary key,                  -- lower(btrim(nume))
  motiv text not null default 'raportat',
  creat timestamptz not null default now()
);

alter table public.nume_raportari enable row level security;
alter table public.nume_interzise enable row level security;
grant select, insert, update, delete on public.nume_raportari to service_role;
grant select, insert, update, delete on public.nume_interzise to service_role;

create or replace function public.nume_implicit(p uuid) returns text
language sql immutable set search_path = public as $$
  select 'Jucător ' || upper(left(p::text, 4));
$$;

-- Un nume interzis nu se mai poate pune, din nicio funcție: revine la cel de început.
create or replace function public.jucatori_nume_permis() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.nume_interzise where nume = lower(btrim(new.nume))) then
    new.nume := public.nume_implicit(new.id);
  end if;
  return new;
end $$;
create trigger jucatori_nume_permis before insert or update of nume on public.jucatori
  for each row execute function public.jucatori_nume_permis();

-- Interzice un nume și îl scoate de la toți cei care îl poartă. Întoarce câți au fost.
create or replace function public.interzice_nume(p_nume text, p_motiv text default 'de mână') returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- numele de început nu se interzic (ar reveni la ele însele)
  if lower(btrim(p_nume)) like 'jucător %' then return 0; end if;
  insert into public.nume_interzise (nume, motiv) values (lower(btrim(p_nume)), p_motiv) on conflict do nothing;
  update public.jucatori set nume = nume where lower(btrim(nume)) = lower(btrim(p_nume));
  get diagnostics n = row_count;
  return n;
end $$;

-- Un raport. Numele trebuie să existe acum (nu se raportează orice text) și nu poate fi
-- al tău. La `p_prag` rapoarte din conturi legate, în 30 de zile, numele se ascunde.
create or replace function public.raporteaza_nume(p_de uuid, p_nume text, p_legat boolean, p_prag int default 3) returns json
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_nume is null or char_length(p_nume) > 16 or not exists (select 1 from public.jucatori where nume = p_nume) then
    return json_build_object('ok', false);
  end if;
  if exists (select 1 from public.jucatori where id = p_de and nume = p_nume) then
    return json_build_object('ok', false);
  end if;
  insert into public.nume_raportari (nume, de, legat) values (p_nume, p_de, p_legat) on conflict do nothing;
  select count(*) into n from public.nume_raportari where nume = p_nume and legat and creat > now() - interval '30 days';
  if n >= p_prag and public.interzice_nume(p_nume, 'raportat') > 0 then
    return json_build_object('ok', true, 'ascuns', true);
  end if;
  return json_build_object('ok', true, 'ascuns', false);
end $$;

revoke all on function public.nume_implicit(uuid) from public, anon, authenticated;
revoke all on function public.interzice_nume(text, text) from public, anon, authenticated;
revoke all on function public.raporteaza_nume(uuid, text, boolean, int) from public, anon, authenticated;
grant execute on function public.nume_implicit(uuid) to service_role;
grant execute on function public.interzice_nume(text, text) to service_role;
grant execute on function public.raporteaza_nume(uuid, text, boolean, int) to service_role;
