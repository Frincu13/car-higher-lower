-- Exemplarele: aceleași drepturi ca garaje. Serverul (funcțiile, cu service_role) le
-- citește și le scrie; jucătorul le vede doar pe ale lui (politica din tabel).
grant select, insert, update, delete on public.exemplare to service_role;
grant select on public.exemplare to authenticated;

-- funcțiile făcute din nou (semnătură nouă) pierd dreptul serverului de a le chema
grant execute on function public.dublura_schimba(uuid, text, text, integer, numeric) to service_role;
grant execute on function public.vinde_exemplar(uuid, bigint, integer, numeric) to service_role;
grant execute on function public.tuneaza_piesa(uuid, bigint, integer, integer, integer) to service_role;
grant execute on function public.tuneaza_piesa_mil(uuid, bigint, integer, integer) to service_role;
grant execute on function public.duel_blocheaza(uuid, text, integer, bigint) to service_role;
grant execute on function public.duel_elibereaza(uuid, text, integer, bigint, integer, text) to service_role;
grant execute on function public.duel_creeaza(uuid, text, integer, bigint, integer, text, integer, integer) to service_role;
grant execute on function public.duel_accepta(uuid, uuid, bigint, integer, integer, integer, integer) to service_role;
grant execute on function public.duel_rapid(uuid, integer, bigint, integer, integer, integer, integer, text) to service_role;
grant execute on function public.exemplar_nou(uuid, text, int, int) to service_role;
