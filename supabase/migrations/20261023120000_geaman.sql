-- Geamănul: și în camere (cu un prieten sau cu un necunoscut).
alter table public.camere drop constraint if exists camere_joc_check;
alter table public.camere add constraint camere_joc_check check (joc = any (array['licitatie', 'draft', 'startul', 'sus-sau-jos', 'ordine', 'carti', 'geaman']));
