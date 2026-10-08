-- Echipa din Startul online: câte o mașină aleasă din garaj pentru fiecare clasă
-- (raritatea timpului după tuning). Duelul rapid pornește direct cu ea. Ce nu e ales
-- se completează pe pagină cu cea mai rapidă mașină din clasa aceea.
create table public.echipe (
  jucator uuid not null references public.jucatori (id) on delete cascade,
  clasa smallint not null check (clasa between 0 and 4),
  masina text not null,
  primary key (jucator, clasa)
);
alter table public.echipe enable row level security;
create policy "echipe: doar a ta" on public.echipe for select to authenticated using (jucator = (select auth.uid()));
grant select on public.echipe to authenticated;
grant select, insert, update, delete on public.echipe to service_role;
