-- Tabelele noi nu primesc drepturi automat (proiectul e creat cu „Automatically
-- expose new tables" oprit), nici pentru rolul de server. Funcțiile de pe server
-- (cheia secretă, rolul service_role) au nevoie de ele ca să scrie clasamentul.
grant select, insert, update, delete on public.jucatori, public.zi_rezultate, public.zi_trimiteri to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.clasament_zi(date, int) to service_role;
