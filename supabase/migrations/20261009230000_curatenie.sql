-- Curățenia o dată pe minut: funcția `camera` (acțiunea 'curata') duce la capăt
-- camerele lăsate în joc (dacă amândoi pierd conexiunea, partida se termină singură
-- și miza se plătește), închide camerele în care n-a intrat nimeni în 30 de minute
-- (cu miza înapoi), expiră duelurile și plătește premiile restante. Cheia din antet
-- e cea publică (aceeași ca în pagină); acțiunea nu cere cont.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule('frq-curatenie', '* * * * *', $$
  select net.http_post(
    url := 'https://zndivyygyomkxyeuvytf.supabase.co/functions/v1/camera',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_VQT1YUz7U7J5g-JVmq-_UQ_pJSAQtXm"}'::jsonb,
    body := '{"actiune": "curata"}'::jsonb
  );
$$);
