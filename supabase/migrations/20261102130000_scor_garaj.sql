-- Scorul garajului: suma scorurilor de performanță (100-999) ale tuturor mașinilor, cu
-- cel mai bun exemplar al fiecăreia. Îl socotește serverul (portofel, cu modelul jocului)
-- și îl notează aici; clasamentele: cele mai tari garaje (de oricând) și cine a crescut
-- cel mai mult într-o săptămână.

create table public.scor_garaj (
  jucator uuid primary key references public.jucatori(id) on delete cascade,
  scor int not null default 0,
  masini int not null default 0,
  actualizat timestamptz not null default now()
);
-- scorul de la începutul fiecărei săptămâni (prima notare din săptămână ia scorul de
-- dinainte); creșterea = scorul de la sfârșit (sau de acum) minus ăsta
create table public.scor_garaj_sapt (
  jucator uuid not null references public.jucatori(id) on delete cascade,
  luni date not null,
  start int not null,
  primary key (jucator, luni)
);
alter table public.scor_garaj enable row level security;
alter table public.scor_garaj_sapt enable row level security;
grant select, insert, update, delete on public.scor_garaj, public.scor_garaj_sapt to service_role;

create function public.noteaza_scor_garaj(p_jucator uuid, p_scor integer, p_masini integer, p_luni date)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.scor_garaj_sapt (jucator, luni, start)
  values (p_jucator, p_luni, coalesce((select scor from public.scor_garaj where jucator = p_jucator), 0))
  on conflict do nothing;
  insert into public.scor_garaj (jucator, scor, masini) values (p_jucator, p_scor, p_masini)
  on conflict (jucator) do update set scor = excluded.scor, masini = excluded.masini,
    actualizat = case when public.scor_garaj.scor <> excluded.scor then now() else public.scor_garaj.actualizat end;
end;
$$;
revoke all on function public.noteaza_scor_garaj(uuid, integer, integer, date) from public, anon, authenticated;
grant execute on function public.noteaza_scor_garaj(uuid, integer, integer, date) to service_role;

-- Clasamentul: fără `p_luni`, cele mai tari garaje; cu `p_luni`, creșterea din săptămâna
-- aceea (la egalitate, cine a ajuns primul acolo).
create function public.clasament_garaj(p_luni date default null, p_limita int default 20)
returns json language sql stable security definer set search_path = '' as $$
  with v as (
    select g.jucator, g.masini, g.actualizat,
      case when p_luni is null then g.scor
        else coalesce((select n.start from public.scor_garaj_sapt n where n.jucator = g.jucator and n.luni = p_luni + 7), g.scor) - s.start end val
    from public.scor_garaj g
    left join public.scor_garaj_sapt s on s.jucator = g.jucator and s.luni = p_luni
    where p_luni is null or s.jucator is not null
  ), r as (
    select v.*, j.nume, row_number() over (order by val desc, v.actualizat) loc
    from v join public.jucatori j on j.id = v.jucator
    where val > 0
  )
  select json_build_object(
    'total', (select count(*) from r),
    'top', coalesce((
      select json_agg(json_build_object('loc', loc, 'nume', nume, case when p_luni is null then 'garaj' else 'crestere' end, val, 'masini', masini, 'eu', jucator = (select auth.uid())) order by loc)
      from r where loc <= least(greatest(p_limita, 1), 50)
    ), '[]'::json),
    'eu', (select json_build_object('loc', loc, case when p_luni is null then 'garaj' else 'crestere' end, val, 'masini', masini) from r where jucator = (select auth.uid()))
  );
$$;
revoke all on function public.clasament_garaj(date, int) from public;
grant execute on function public.clasament_garaj(date, int) to anon, authenticated;
