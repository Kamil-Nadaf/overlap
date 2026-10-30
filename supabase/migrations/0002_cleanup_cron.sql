-- Nightly cleanup of expired events (cascades to participants/availability).
-- If `create extension` fails, enable pg_cron in Dashboard > Database > Extensions first.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'overlap-expire-events',
  '17 3 * * *',
  $$ delete from public.events where expires_at < now() $$
);
