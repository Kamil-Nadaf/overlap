-- 0006: anonymous usage counters that survive event deletion (events are deleted after the meeting).
--   events_created     = grids created
--   meetings_scheduled = events that got a final time (first time only per event)
-- Counted by triggers, so no other function had to change. get_stats() is public and returns only the two numbers.

create table if not exists public.stats (
  name  text primary key,
  value bigint not null default 0
);
alter table public.stats enable row level security;
revoke all on public.stats from anon, authenticated;

insert into public.stats (name, value) values
  ('events_created',     (select count(*) from public.events)),
  ('meetings_scheduled', (select count(*) from public.events where final_start is not null))
on conflict (name) do nothing;

create or replace function public.stats_on_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stats (name, value) values ('events_created', 1)
    on conflict (name) do update set value = public.stats.value + 1;
  elsif old.final_start is null and new.final_start is not null then
    insert into public.stats (name, value) values ('meetings_scheduled', 1)
    on conflict (name) do update set value = public.stats.value + 1;
  end if;
  return null;
end;
$$;
revoke execute on function public.stats_on_event() from public, anon, authenticated;

drop trigger if exists stats_events_ins on public.events;
create trigger stats_events_ins after insert on public.events
  for each row execute function public.stats_on_event();
drop trigger if exists stats_events_upd on public.events;
create trigger stats_events_upd after update of final_start on public.events
  for each row execute function public.stats_on_event();

create or replace function public.get_stats()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(name, value), '{}'::jsonb) from public.stats;
$$;
grant execute on function public.get_stats() to anon, authenticated;
