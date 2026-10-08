-- Revanșa: încă o partidă în aceeași cameră, cu aceeași miză. Fiecare o cere (sau o
-- acceptă) de pe telefonul lui; când au cerut-o amândoi, miza se blochează din nou
-- la amândoi și camera trece înapoi în joc. Cine începe alternează (`runda`).
alter table public.camere add column revansa_a boolean not null default false;
alter table public.camere add column revansa_b boolean not null default false;
alter table public.camere add column runda integer not null default 1;

create or replace function public.camera_revansa(p_camera uuid, p_jucator uuid)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  c public.camere;
  eu_a boolean;
begin
  select * into c from public.camere where id = p_camera for update;
  if not found or (c.a <> p_jucator and c.b is distinct from p_jucator) then return json_build_object('eroare', 'camera'); end if;
  if c.stare <> 'gata' or c.b is null then return json_build_object('eroare', 'stare'); end if;
  eu_a := c.a = p_jucator;
  if c.miza > 0 and not exists (select 1 from public.portofele where jucator = p_jucator and mil >= c.miza) then
    return json_build_object('eroare', 'bani');
  end if;
  if (eu_a and c.revansa_b) or (not eu_a and c.revansa_a) then
    -- amândoi vor: miza din nou, la amândoi (celălalt poate să fi rămas fără bani)
    if c.miza > 0 then
      if (select count(*) from public.portofele where jucator in (c.a, c.b) and mil >= c.miza) < 2 then
        return json_build_object('eroare', 'bani');
      end if;
      update public.portofele set mil = mil - c.miza, actualizat = now() where jucator in (c.a, c.b);
      insert into public.miscari (jucator, mil, motiv, detalii)
      select j, -c.miza, 'miza camera', json_build_object('cod', c.cod, 'revansa', true)::jsonb from unnest(array[c.a, c.b]) j;
    end if;
    update public.camere set revansa_a = false, revansa_b = false, platit = false, runda = runda + 1,
      stare = 'joc', v = v + 1, actualizat = now()
    where id = p_camera;
    return json_build_object('porneste', true, 'runda', c.runda + 1);
  end if;
  update public.camere set revansa_a = revansa_a or eu_a, revansa_b = revansa_b or not eu_a, v = v + 1, actualizat = now()
  where id = p_camera;
  return json_build_object('asteapta', true);
end;
$$;
revoke all on function public.camera_revansa(uuid, uuid) from public, anon, authenticated;
grant execute on function public.camera_revansa(uuid, uuid) to service_role;
