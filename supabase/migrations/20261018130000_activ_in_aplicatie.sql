-- Cine are aplicația deschisă chiar acum (telefonul anunță la ~30 s cât e vizibilă):
-- lui nu-i trimitem notificare pe telefon, ci mesajul direct în aplicație (Realtime).
alter table public.jucatori add column if not exists activ_la timestamptz;
