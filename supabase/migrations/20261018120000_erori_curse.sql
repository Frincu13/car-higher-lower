-- Cursele respinse de server (dueluri, Cursa zilei, Cupa), cu ce a trimis telefonul:
-- jurnalele Supabase nu se pot citi pe planul gratuit, iar o cursă pierdută trebuie să
-- poată fi înțeleasă după. Doar serverul scrie și citește.
create table public.erori_curse (
  id bigint generated always as identity primary key,
  jucator uuid,
  functie text not null,
  eroare text not null,
  corp jsonb,
  creat timestamptz not null default now()
);
alter table public.erori_curse enable row level security;
grant select, insert, update, delete on public.erori_curse to service_role;
create index erori_curse_creat on public.erori_curse (creat desc);
