-- 0004: delete an event's data automatically once the meeting is over, and sooner if nobody uses it.
--   * scheduled events: deleted 1 day after the meeting ends
--   * unscheduled events: deleted 60 days after the last activity (was 180)
-- Participants, availability and reminder rows go with the event (on delete cascade).

alter table public.events alter column expires_at set default now() + interval '60 days';

create or replace function public.save_availability(
  p_event_id text,
  p_name text,
  p_pin text,
  p_email text,
  p_wants_reminder boolean,
  p_slots jsonb
) returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_name text := btrim(p_name);
  v_pin  text := nullif(p_pin, '');
  v_mail text := nullif(btrim(p_email), '');
  v_p    public.participants;
begin
  if v_name = '' then raise exception 'name_required'; end if;
  if not exists (select 1 from public.events
                  where id = p_event_id and expires_at > now()) then
    raise exception 'event_not_found';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 3000 then
    raise exception 'invalid_slots';
  end if;

  select * into v_p from public.participants
   where event_id = p_event_id and lower(name) = lower(v_name);

  if found then
    if v_p.pin_hash is not null
       and (v_pin is null or v_p.pin_hash <> crypt(v_pin, v_p.pin_hash)) then
      raise exception 'wrong_pin';
    end if;
    update public.participants
       set email = v_mail,
           wants_reminder = coalesce(p_wants_reminder, false),
           pin_hash = coalesce(v_p.pin_hash,
                        case when v_pin is not null then crypt(v_pin, gen_salt('bf')) end),
           updated_at = now()
     where id = v_p.id;
    delete from public.availability where participant_id = v_p.id;
  else
    insert into public.participants (event_id, name, pin_hash, email, wants_reminder)
    values (p_event_id, v_name,
            case when v_pin is not null then crypt(v_pin, gen_salt('bf')) end,
            v_mail, coalesce(p_wants_reminder, false))
    returning * into v_p;
  end if;

  insert into public.availability (participant_id, slot_start, level)
  select v_p.id, (x->>'s')::timestamptz, (x->>'l')::smallint
    from jsonb_array_elements(p_slots) x
  on conflict do nothing;

  update public.events set expires_at = now() + interval '60 days'
   where id = p_event_id;

  return jsonb_build_object('participant_id', v_p.id);
end;
$$;

create or replace function public.cleanup_events()
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  with d as (
    delete from public.events
     where expires_at < now()
        or (final_end is not null and final_end < now() - interval '1 day')
    returning 1)
  select count(*) into n from d;
  return n;
end;
$$;
revoke execute on function public.cleanup_events() from public, anon, authenticated;

-- Shorten existing unscheduled events too (they were created with 180 days).
update public.events set expires_at = least(expires_at, now() + interval '60 days')
 where final_end is null;

-- Run the cleanup every hour (needs pg_cron; harmless if unavailable, the worker also cleans up).
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('overlap-expire-events', '17 * * * *', 'select public.cleanup_events()');
exception when others then
  raise notice 'pg_cron not enabled, skipping scheduled cleanup: %', sqlerrm;
end
$$;
