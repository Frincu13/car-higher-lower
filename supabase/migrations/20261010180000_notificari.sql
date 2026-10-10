-- Notificările pe telefon: un rând pe telefon abonat (adresa serviciului de push și
-- cheile lui), al cui e și ce tipuri vrea. Doar funcțiile de pe server (cu cheia de
-- serviciu) citesc și scriu aici; pagina trece prin funcția `notificari`.
create table if not exists public.notificari (
  endpoint text primary key,
  jucator uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  tipuri jsonb not null default '{"dueluri": true, "cupa": true, "serie": true, "noutati": true}',
  creat timestamptz not null default now(),
  folosit timestamptz not null default now(),
  ultimul_test timestamptz
);
create index if not exists notificari_jucator on public.notificari (jucator);

alter table public.notificari enable row level security;
revoke all on public.notificari from anon, authenticated;
grant select, insert, update, delete on public.notificari to service_role;
