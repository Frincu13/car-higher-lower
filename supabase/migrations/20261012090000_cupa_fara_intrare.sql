-- Cupa de duminică fără intrare: oricine aleargă măcar o dată primește o sumă, iar
-- primii trei premii fixe. Locul 1 ia și mașina cupei, locul 2 o ladă deschisă pe
-- loc (mașina o trage funcția de pe server și o trimite aici). Mașinile vin ca la
-- lăzi: nouă în garaj sau o bucată în plus (dublură).
create or replace function public.plateste_cupa_premii(
  p_data date, p_premii int[], p_participare int,
  p_masina1 text, p_raritate1 int, p_masina2 text, p_raritate2 int
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_cheie text := 'cupa:' || p_data;
  n int;
  x record;
  suma int;
  platiti json[] := '{}';
begin
  if p_data >= (now() at time zone 'Europe/Bucharest')::date then return json_build_object('eroare', 'in curs'); end if;
  insert into public.premii_platite (cheie) values (v_cheie) on conflict do nothing;
  if not found then return json_build_object('deja', true); end if;
  select count(*) into n from public.cupa_inscrieri where data = p_data and timp_ms is not null;
  for x in
    select jucator, row_number() over (order by timp_ms, actualizat) as loc
    from public.cupa_inscrieri where data = p_data and timp_ms is not null
    order by loc
  loop
    suma := p_participare + coalesce(p_premii[x.loc::int], 0);
    perform public.recompensa(x.jucator, suma, 0, case when x.loc <= 3 then 'premiu cupa' else 'cupa' end, v_cheie,
      json_build_object('data', p_data, 'loc', x.loc, 'masina', case x.loc when 1 then p_masina1 when 2 then p_masina2 end)::jsonb);
    if x.loc in (1, 2) then
      insert into public.garaje (jucator, masina, raritate)
      values (x.jucator, case when x.loc = 1 then p_masina1 else p_masina2 end, case when x.loc = 1 then p_raritate1 else p_raritate2 end)
      on conflict (jucator, masina) do update set bucati = public.garaje.bucati + 1;
    end if;
    if x.loc <= 3 then platiti := platiti || json_build_object('loc', x.loc, 'mil', suma); end if;
  end loop;
  update public.premii_platite set detalii = json_build_object('alergat', n, 'platiti', platiti)::jsonb where cheie = v_cheie;
  return json_build_object('alergat', n, 'platiti', platiti);
end;
$$;
revoke all on function public.plateste_cupa_premii(date, int[], int, text, int, text, int) from public, anon, authenticated;
grant execute on function public.plateste_cupa_premii(date, int[], int, text, int, text, int) to service_role;
