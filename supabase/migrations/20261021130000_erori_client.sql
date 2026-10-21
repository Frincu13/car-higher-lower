-- Erorile din pagini (telefoane și calculatoare), ca să aflăm de o problemă înainte să
-- ne-o spună cineva. Le scrie doar funcția `erori`; se șterg după 30 de zile (curata).
create table if not exists public.erori_client (
  id bigserial primary key,
  jucator uuid,
  pagina text not null,
  mesaj text not null,
  sursa text,
  stiva text,
  versiune text,
  dispozitiv text,
  creat timestamptz not null default now()
);
create index if not exists erori_client_creat on public.erori_client (creat desc);
alter table public.erori_client enable row level security;
revoke all on table public.erori_client from public, anon, authenticated;
