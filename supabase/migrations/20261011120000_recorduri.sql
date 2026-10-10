-- Recordurile pe mașini: cel mai bun timp al fiecărui jucător cu fiecare mașină, pe
-- sfertul de milă. Pagina nu mai arată timpul „din fișă" al mașinii (doar clasa și
-- scorul): secundele le descoperă jucătorul, alergând. Le scriu doar funcțiile de pe
-- server, din curse refăcute din apăsări (dueluri, Cupa, Cursa zilei, cursa live,
-- antrenamentul); fiecare își citește doar recordurile lui, iar cel mai bun timp de
-- pe FRQ al unei mașini vine prin record_masina.
create table if not exists public.recorduri (
  jucator uuid not null references auth.users (id) on delete cascade,
  masina text not null,
  timp_ms integer not null check (timp_ms > 0),
  creat timestamptz not null default now(),
  primary key (jucator, masina)
);
create index if not exists recorduri_masina on public.recorduri (masina, timp_ms);

alter table public.recorduri enable row level security;
drop policy if exists "recordurile mele" on public.recorduri;
create policy "recordurile mele" on public.recorduri for select to authenticated using (jucator = (select auth.uid()));
revoke all on public.recorduri from anon, authenticated;
grant select on public.recorduri to authenticated;
grant select, insert, update, delete on public.recorduri to service_role;

-- Un timp nou: rămâne doar dacă e mai bun. Întoarce true dacă e record.
create or replace function public.noteaza_record(p_jucator uuid, p_masina text, p_timp int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_timp is null or p_timp <= 0 or p_masina is null then return false; end if;
  insert into public.recorduri (jucator, masina, timp_ms) values (p_jucator, p_masina, p_timp)
  on conflict (jucator, masina) do update set timp_ms = excluded.timp_ms, creat = now()
  where public.recorduri.timp_ms > excluded.timp_ms;
  return found;
end;
$$;
revoke all on function public.noteaza_record(uuid, text, int) from public, anon, authenticated;
grant execute on function public.noteaza_record(uuid, text, int) to service_role;

-- Cel mai bun timp de pe FRQ cu o mașină și cine l-a scos.
create or replace function public.record_masina(p_masina text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('timp', r.timp_ms, 'nume', coalesce(j.nume, 'Un jucător'))
    from public.recorduri r left join public.jucatori j on j.id = r.jucator
   where r.masina = p_masina
   order by r.timp_ms, r.creat
   limit 1;
$$;
revoke all on function public.record_masina(text) from public;
grant execute on function public.record_masina(text) to anon, authenticated, service_role;
