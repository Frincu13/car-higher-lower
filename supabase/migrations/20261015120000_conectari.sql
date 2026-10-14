-- Intrarea în cont din aplicația de pe ecranul principal (iPhone): linkul din mail se
-- deschide în Safari, care nu-și împarte datele cu aplicația. Aplicația face o cerere
-- (id + o cheie secretă pe care o ține doar ea), Safari trimite aici codul din link,
-- iar aplicația îl ia cu cheia și îl schimbă singură pe sesiune. Codul nu folosește
-- la nimic fără verificatorul PKCE, care stă doar în aplicație.
create table public.conectari (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  cod text,
  creat timestamptz not null default now()
);
alter table public.conectari enable row level security;
grant select, insert, update, delete on public.conectari to service_role;
