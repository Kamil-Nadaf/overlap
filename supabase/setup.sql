-- Overlap: one-paste setup for a Supabase project (Dashboard > SQL Editor > New query > paste > Run).
-- Safe to run once on a fresh project. Nothing here is needed for the Docker stack (it runs 0001 itself).

-- Overlap: initial schema
-- Run in Supabase SQL editor, or `supabase db push`.
-- Security model: RLS on, NO policies, anon has no table access.
-- The browser only talks to SECURITY DEFINER functions (RPCs) below.
-- Participant emails are never returned by any RPC; only the
-- send-reminders Edge Function (service role) reads them.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- helpers
create or replace function public.overlap_new_id(p_len int default 10)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select string_agg(
    substr('abcdefghijkmnpqrstuvwxyz23456789',
           1 + (get_byte(gen_random_bytes(1), 0) % 32), 1), '')
  from generate_series(1, p_len);
$$;

-- ----------------------------------------------------------------- tables
create table public.events (
  id               text primary key default public.overlap_new_id(),
  title            text not null check (char_length(title) between 1 and 120),
  description      text check (char_length(description) <= 2000),
  dates            date[] not null check (cardinality(dates) between 1 and 60),
  day_start_min    smallint not null default 540  check (day_start_min between 0 and 1439),
  day_end_min      smallint not null default 1080 check (day_end_min between 1 and 1440),
  slot_minutes     smallint not null default 30   check (slot_minutes in (15, 30, 60)),
  timezone         text not null default 'UTC',          -- IANA name
  meeting_url      text check (meeting_url is null or meeting_url ~* '^https?://\S+$'),
  organizer_name   text check (char_length(organizer_name) <= 60),
  organizer_email  text check (organizer_email is null
                               or organizer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  admin_token_hash text not null,
  final_start      timestamptz,
  final_end        timestamptz,
  reminder_offsets_min int[] not null default '{1440,60}',
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '180 days',
  check (day_end_min > day_start_min),
  check ((final_start is null) = (final_end is null)),
  check (final_end is null or final_end > final_start)
);

create table public.participants (
  id             uuid primary key default gen_random_uuid(),
  event_id       text not null references public.events(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 40),
  pin_hash       text,
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  wants_reminder boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index participants_event_name_uq
  on public.participants (event_id, lower(name));

-- level: 2 = available, 1 = if need be. Absent row = not available.
create table public.availability (
  participant_id uuid not null references public.participants(id) on delete cascade,
  slot_start     timestamptz not null,
  level          smallint not null check (level in (1, 2)),
  primary key (participant_id, slot_start)
);

-- Dedupe log for reminders. final_start in key so a reschedule re-sends.
create table public.reminders_sent (
  event_id     text not null references public.events(id) on delete cascade,
  final_start  timestamptz not null,
  offset_min   int not null,
  recipient    text not null,
  sent_at      timestamptz not null default now(),
  primary key (event_id, final_start, offset_min, recipient)
);

alter table public.events        enable row level security;
alter table public.participants  enable row level security;
alter table public.availability  enable row level security;
alter table public.reminders_sent enable row level security;
revoke all on public.events, public.participants,
              public.availability, public.reminders_sent from anon, authenticated;

-- -------------------------------------------------------------------- RPCs
create or replace function public.ping()
returns timestamptz
language sql security definer set search_path = public
as $$ select now(); $$;

create or replace function public.create_event(
  p_title text,
  p_description text,
  p_dates date[],
  p_day_start_min int,
  p_day_end_min int,
  p_slot_minutes int,
  p_timezone text,
  p_meeting_url text,
  p_organizer_name text,
  p_organizer_email text,
  p_reminder_offsets int[]
) returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(16), 'hex');
  v_id    text;
begin
  perform now() at time zone p_timezone;   -- raises on invalid IANA name
  insert into public.events (
    title, description, dates, day_start_min, day_end_min, slot_minutes,
    timezone, meeting_url, organizer_name, organizer_email,
    reminder_offsets_min, admin_token_hash
  ) values (
    btrim(p_title),
    nullif(btrim(p_description), ''),
    (select array_agg(distinct d order by d) from unnest(p_dates) d),
    p_day_start_min, p_day_end_min, p_slot_minutes,
    p_timezone,
    nullif(btrim(p_meeting_url), ''),
    nullif(btrim(p_organizer_name), ''),
    nullif(btrim(p_organizer_email), ''),
    coalesce(p_reminder_offsets, '{1440,60}'),
    encode(digest(v_token, 'sha256'), 'hex')
  ) returning id into v_id;
  return jsonb_build_object('id', v_id, 'admin_token', v_token);
end;
$$;

-- Everything the UI needs in one round trip. No emails, no hashes.
create or replace function public.get_event(p_id text)
returns jsonb
language sql security definer stable set search_path = public
as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'description', e.description,
      'dates', e.dates, 'day_start_min', e.day_start_min,
      'day_end_min', e.day_end_min, 'slot_minutes', e.slot_minutes,
      'timezone', e.timezone, 'meeting_url', e.meeting_url,
      'organizer_name', e.organizer_name,
      'final_start', e.final_start, 'final_end', e.final_end),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'has_pin', p.pin_hash is not null)
             order by p.created_at)
      from public.participants p where p.event_id = e.id), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(jsonb_build_object(
               'p', a.participant_id, 's', a.slot_start, 'l', a.level))
      from public.availability a
      join public.participants p on p.id = a.participant_id
      where p.event_id = e.id), '[]'::jsonb)
  )
  from public.events e
  where e.id = p_id and e.expires_at > now();
$$;

-- Sign-in check (name + optional PIN) so the UI can load "my" slots.
create or replace function public.verify_participant(
  p_event_id text, p_name text, p_pin text
) returns boolean
language plpgsql security definer stable set search_path = public, extensions
as $$
declare v public.participants;
begin
  select * into v from public.participants
   where event_id = p_event_id and lower(name) = lower(btrim(p_name));
  if not found then return false; end if;
  if v.pin_hash is null then return true; end if;
  return nullif(p_pin, '') is not null
         and v.pin_hash = crypt(p_pin, v.pin_hash);
end;
$$;

-- Create-or-replace a participant's whole availability.
-- p_slots: [{"s":"2026-11-02T01:00:00Z","l":2}, ...]
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

  update public.events set expires_at = now() + interval '180 days'
   where id = p_event_id;

  return jsonb_build_object('participant_id', v_p.id);
end;
$$;

create or replace function public.verify_admin(p_id text, p_token text)
returns boolean
language sql security definer stable set search_path = public, extensions
as $$
  select exists (
    select 1 from public.events
     where id = p_id
       and admin_token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex'));
$$;

-- Organizer picks the final slot (null start = un-finalize).
create or replace function public.finalize_event(
  p_id text, p_admin_token text,
  p_start timestamptz, p_end timestamptz, p_meeting_url text
) returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not public.verify_admin(p_id, p_admin_token) then
    raise exception 'forbidden';
  end if;
  update public.events
     set final_start = p_start,
         final_end   = p_end,
         meeting_url = coalesce(nullif(btrim(p_meeting_url), ''), meeting_url)
   where id = p_id;
end;
$$;

create or replace function public.delete_event(p_id text, p_admin_token text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not public.verify_admin(p_id, p_admin_token) then
    raise exception 'forbidden';
  end if;
  delete from public.events where id = p_id;
end;
$$;

-- ------------------------------------------------------------------ grants
revoke execute on function public.overlap_new_id(int) from public, anon, authenticated;
grant execute on function
  public.ping(),
  public.create_event(text, text, date[], int, int, int, text, text, text, text, int[]),
  public.get_event(text),
  public.verify_participant(text, text, text),
  public.save_availability(text, text, text, text, boolean, jsonb),
  public.verify_admin(text, text),
  public.finalize_event(text, text, timestamptz, timestamptz, text),
  public.delete_event(text, text)
to anon, authenticated;


-- ------------------------------------------------- nightly cleanup (optional)
-- Deletes expired events. If pg_cron is not available the rest of the setup above still stands.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('overlap-expire-events', '17 3 * * *', 'delete from public.events where expires_at < now()');
exception when others then
  raise notice 'pg_cron not enabled, skipping nightly cleanup: %', sqlerrm;
end
$$;
