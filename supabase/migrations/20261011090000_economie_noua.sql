-- Economia nouă (economie.js): bani din partidele cu cronometru și din victoriile cu
-- un prieten, cu plafon pe zi; seria de zile cu o zi de grație; bonusul de trecere.

-- Câștigul din joc: partidele și victoriile aduc împreună cel mult p_plafon mil. pe zi
-- (ziua României, p_data). Portofelul se blochează cât se socotește, ca două partide
-- terminate în aceeași clipă să nu treacă amândouă de plafon. p_cheie face plata
-- unică (o partidă sau o victorie se plătește o singură dată). Întoarce cât s-a dat.
create or replace function public.castig_joc(p_jucator uuid, p_mil int, p_plafon int, p_motiv text, p_cheie text, p_data date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  luat int;
  dat int;
begin
  if p_mil is null or p_mil <= 0 or p_motiv not in ('partida', 'victorie') then return 0; end if;
  perform 1 from public.portofele where jucator = p_jucator for update;
  if not found then return 0; end if;
  select coalesce(sum(mil), 0) into luat from public.miscari
   where jucator = p_jucator and motiv in ('partida', 'victorie') and detalii ->> 'zi' = p_data::text;
  dat := least(p_mil, greatest(0, p_plafon - luat));
  if dat <= 0 then return 0; end if;
  insert into public.miscari (jucator, mil, motiv, cheie, detalii)
  values (p_jucator, dat, p_motiv, p_cheie, jsonb_build_object('zi', p_data::text))
  on conflict (jucator, cheie) do nothing;
  if not found then return 0; end if;
  update public.portofele set mil = mil + dat, actualizat = now() where jucator = p_jucator;
  return dat;
end;
$$;
revoke all on function public.castig_joc(uuid, int, int, text, text, date) from public, anon, authenticated;
grant execute on function public.castig_joc(uuid, int, int, text, text, date) to service_role;

-- Seria de zile: o zi lipsă nu o rupe (ieri sau alaltăieri ține seria).
create or replace function public.noteaza_zi(p_jucator uuid, p_data date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.portofele;
begin
  select * into p from public.portofele where jucator = p_jucator for update;
  if p.ultima_zi is not distinct from p_data then
    return json_build_object('serie', p.serie, 'prima', false);
  end if;
  if p.ultima_zi is not null and p_data < p.ultima_zi then
    return json_build_object('serie', p.serie, 'prima', false);
  end if;
  update public.portofele
     set serie = case when p.ultima_zi >= p_data - 2 then p.serie + 1 else 1 end,
         ultima_zi = p_data, actualizat = now()
   where jucator = p_jucator
  returning serie into p.serie;
  return json_build_object('serie', p.serie, 'prima', true);
end;
$$;

-- Bonusul de trecere la economia nouă: 50 mil., o singură dată pe cont (cheia unică).
select public.recompensa(jucator, 50, 0, 'bonus economia noua', 'lansare:economie-2026-10', null)
  from public.portofele;
