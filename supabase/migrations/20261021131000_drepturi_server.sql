-- Tabelele noi nu primesc singure drepturi pentru server (service_role): le dăm explicit.
grant select, insert, delete on table public.erori_client to service_role;
grant usage, select on sequence public.erori_client_id_seq to service_role;
grant select, insert, update, delete on table public.limite_cereri to service_role;
