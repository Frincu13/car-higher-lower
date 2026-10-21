-- Limită de cereri, comună tuturor funcțiilor: câte cereri pe o cheie (de obicei
-- „funcție:acțiune:jucător", la conectare „…:ip") într-o fereastră de timp. Atomic:
-- două cereri deodată nu trec amândouă de prag. Doar serverul o folosește.
create table if not exists public.limite_cereri (
  cheie text primary key,
  inceput timestamptz not null default now(),
  n int not null default 0
);
alter table public.limite_cereri enable row level security;

create or replace function public.cerere_permisa(p_cheie text, p_max int, p_secunde int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  r public.limite_cereri;
begin
  insert into public.limite_cereri as l (cheie, inceput, n) values (p_cheie, now(), 1)
  on conflict (cheie) do update set
    n = case when l.inceput < now() - make_interval(secs => p_secunde) then 1 else l.n + 1 end,
    inceput = case when l.inceput < now() - make_interval(secs => p_secunde) then now() else l.inceput end
  returning * into r;
  return r.n <= p_max;
end;
$$;
revoke all on function public.cerere_permisa(text, int, int) from public, anon, authenticated;
grant execute on function public.cerere_permisa(text, int, int) to service_role;
revoke all on table public.limite_cereri from public, anon, authenticated;
