-- Camerele Cursei pot fi live (lobby: toți deodată, gazda pornește calificarea și cursa) sau
-- clasament (fiecare face tururi când are timp, până se închide camera).
alter table public.cursa_camere add column if not exists tip text not null default 'clasament' check (tip in ('live', 'clasament'));
