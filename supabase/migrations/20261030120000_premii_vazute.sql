-- Premiile văzute le ține minte contul, nu telefonul: ce ai văzut pe telefon nu mai
-- apare în browser. Tot ce era deja în portofel trece ca văzut (fiecare a apucat să
-- le vadă undeva), ca nimeni să nu primească la prima deschidere un teanc de premii vechi.
alter table public.miscari add column if not exists vazut boolean not null default false;
update public.miscari set vazut = true where not vazut;
