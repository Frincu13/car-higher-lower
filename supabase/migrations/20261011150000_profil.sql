-- Profilul jucătorului: statisticile și realizările lui, într-o singură cerere.
-- Majoritatea vin din ce există deja (recorduri, provocări, dueluri, garaj, premii);
-- pentru ce nu se ținea nicăieri (camerele câștigate) e un tabel mic de contoare,
-- scris doar de funcțiile de pe server.
create table if not exists public.statistici (
  jucator uuid not null references auth.users (id) on delete cascade,
  cheie text not null,
  n integer not null default 0,
  primary key (jucator, cheie)
);
alter table public.statistici enable row level security;
revoke all on public.statistici from anon, authenticated;
grant select, insert, update, delete on public.statistici to service_role;

create or replace function public.stat_creste(p_jucator uuid, p_cheie text, p_cu int default 1)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.statistici (jucator, cheie, n) values (p_jucator, p_cheie, p_cu)
  on conflict (jucator, cheie) do update set n = public.statistici.n + excluded.n;
$$;
revoke all on function public.stat_creste(uuid, text, int) from public, anon, authenticated;
grant execute on function public.stat_creste(uuid, text, int) to service_role;

-- Profilul tău (al contului cu care întrebi): doar citire, doar despre tine.
create or replace function public.profil_meu()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with eu as (select auth.uid() as id)
  select case when (select id from eu) is null then null else json_build_object(
    'nume', (select nume from public.jucatori where id = (select id from eu)),
    'din', (select created_at from auth.users where id = (select id from eu)),
    'portofel', (select json_build_object('mil', mil, 'serie', serie, 'ultima_zi', ultima_zi) from public.portofele where jucator = (select id from eu)),
    'garaj', (select json_build_object('masini', count(*), 'legendare', count(*) filter (where raritate = 4), 'exotice', count(*) filter (where raritate = 3), 'nivel5', count(*) filter (where nivel >= 5)) from public.garaje where jucator = (select id from eu)),
    'seturi', (select count(*) from public.miscari where jucator = (select id from eu) and motiv = 'set complet'),
    'misiuni', (select count(*) from public.miscari where jucator = (select id from eu) and motiv = 'misiune'),
    'lazi', (select count(*) from public.miscari where jucator = (select id from eu) and motiv in ('lada', 'lada gratis')),
    'general', (select coalesce(json_agg(json_build_object('joc', joc, 'cat', cat, 'scor', scor, 'timp', timp_ms)), '[]'::json) from public.scoruri_general where jucator = (select id from eu)),
    'provocari', (select count(*) from public.scoruri_zi where jucator = (select id from eu)) + (select count(*) from public.zi_rezultate where jucator = (select id from eu)),
    'zile', (select count(distinct d) from (select data as d from public.scoruri_zi where jucator = (select id from eu) union select data from public.zi_rezultate where jucator = (select id from eu)) z),
    'cursa_zilei', (select min(timp_ms) from public.zi_rezultate where jucator = (select id from eu)),
    'dueluri', (select json_build_object(
        'jucate', count(*) filter (where stare = 'incheiat'),
        'castigate', count(*) filter (where stare = 'incheiat' and castigator = (select id from eu)),
        'acte', count(*) filter (where stare = 'incheiat' and tip = 'acte' and castigator = (select id from eu)))
      from public.dueluri where a = (select id from eu) or b = (select id from eu)),
    'podium_saptamana', (select count(*) from public.miscari where jucator = (select id from eu) and motiv = 'premiul saptamanii'),
    'podium_cupa', (select count(*) from public.miscari where jucator = (select id from eu) and motiv = 'premiu cupa'),
    'recorduri', (select count(*) from public.recorduri where jucator = (select id from eu)),
    'stat', (select coalesce(json_object_agg(cheie, n), '{}'::json) from public.statistici where jucator = (select id from eu))
  ) end;
$$;
revoke all on function public.profil_meu() from public, anon;
grant execute on function public.profil_meu() to authenticated;
