-- Curățenia pornește funcția doar când chiar are ce face. În fiecare minut, baza de
-- date verifică singură (o interogare mică, fără să cheme nimic din afară) dacă:
-- o cameră în joc are termenul trecut, o cameră așteaptă de peste 30 de minute
-- sau un duel are termenul trecut. Doar atunci cheamă funcția `camera`. Premiile
-- săptămânii și ale cupei se plătesc o dată pe zi (22:10 UTC, adică după miezul
-- nopții în România) sau la prima vizită în Garaj ori în Startul.
create or replace function public.e_ceva_de_curatat()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1 from public.camere
      where stare = 'joc' and (public->>'termen') is not null
        and (public->>'termen')::bigint <= (extract(epoch from now()) * 1000)::bigint
    )
    or exists (select 1 from public.camere where stare = 'asteapta' and creat < now() - interval '30 minutes')
    or exists (select 1 from public.dueluri where stare in ('pregatit', 'deschis', 'acceptat') and termen < now());
$$;
revoke all on function public.e_ceva_de_curatat() from public, anon, authenticated;

select cron.unschedule('frq-curatenie');
select cron.schedule('frq-curatenie', '* * * * *', $$
  select net.http_post(
    url := 'https://zndivyygyomkxyeuvytf.supabase.co/functions/v1/camera',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_VQT1YUz7U7J5g-JVmq-_UQ_pJSAQtXm"}'::jsonb,
    body := '{"actiune": "curata"}'::jsonb
  ) where public.e_ceva_de_curatat();
$$);
select cron.schedule('frq-premii-zilnic', '10 22 * * *', $$
  select net.http_post(
    url := 'https://zndivyygyomkxyeuvytf.supabase.co/functions/v1/camera',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_VQT1YUz7U7J5g-JVmq-_UQ_pJSAQtXm"}'::jsonb,
    body := '{"actiune": "curata"}'::jsonb
  );
$$);
