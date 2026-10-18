-- Duel de cărți: partidele contra botului stau în `partide` (joc 'carti', cat 'bot<nivel>'),
-- cu pachetul în `date`; cu un prieten, în camere, ca celelalte jocuri.
alter table public.partide add column if not exists date jsonb;
alter table public.partide drop constraint if exists partide_joc_check;
alter table public.partide add constraint partide_joc_check check (joc = any (array['sus-sau-jos', 'ordine', 'carti']));
alter table public.camere drop constraint if exists camere_joc_check;
alter table public.camere add constraint camere_joc_check check (joc = any (array['licitatie', 'draft', 'startul', 'sus-sau-jos', 'ordine', 'carti']));
