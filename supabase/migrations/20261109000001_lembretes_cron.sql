-- Lembretes de 24h e 2h: o pg_cron chama a Edge Function "lembretes" a cada 15 min.
-- A função é idempotente e não devolve dados, então não precisa de chave aqui.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('karvbusca-lembretes')
where exists (select 1 from cron.job where jobname = 'karvbusca-lembretes');

select cron.schedule(
  'karvbusca-lembretes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://osoraqtjjfpuennawuxx.supabase.co/functions/v1/lembretes',
    headers := '{"content-type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
