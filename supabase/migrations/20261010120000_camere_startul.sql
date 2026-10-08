-- Camere pentru Startul live (și, după, Sus sau jos și În ordine pe rând): jocurile
-- noi și opțiunile camerei (la Startul, clasa mașinilor).
alter table public.camere drop constraint camere_joc_check;
alter table public.camere add constraint camere_joc_check check (joc in ('licitatie', 'draft', 'startul', 'sus-sau-jos', 'ordine'));
alter table public.camere add column optiuni jsonb not null default '{}'::jsonb;
