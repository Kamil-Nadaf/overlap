# Data model and RPC contract

Source of truth: `supabase/migrations/0001_init.sql`. This file explains it.

## Tables
| Table | Key columns | Notes |
|---|---|---|
| `events` | `id` (10-char), `title`, `description`, `dates date[]`, `day_start_min`, `day_end_min`, `slot_minutes`, `timezone`, `meeting_url`, `organizer_name`, `organizer_email`, `admin_token_hash`, `final_start/end`, `reminder_offsets_min int[]`, `expires_at` | Window minutes are in the **event** time zone |
| `participants` | `id uuid`, `event_id`, `name`, `pin_hash`, `email`, `wants_reminder` | Unique `(event_id, lower(name))` |
| `availability` | `(participant_id, slot_start timestamptz)`, `level` 1 = if need be, 2 = available | Absent = busy |
| `reminders_sent` | `(event_id, final_start, offset_min, recipient)` | Dedupe; reschedule changes `final_start` so it re-sends |

## RPCs (all `SECURITY DEFINER`, callable by `anon`)
| RPC | Args | Returns | Errors |
|---|---|---|---|
| `ping()` | none | `timestamptz` | none; used by keepalive |
| `create_event` | title, description, dates[], day_start_min, day_end_min, slot_minutes, timezone, meeting_url, organizer_name, organizer_email, reminder_offsets[] | `{id, admin_token}` | invalid tz, check violations |
| `get_event(p_id)` | id | `{event, participants[{id,name,has_pin}], availability[{p,s,l}]}` or `null` | none |
| `verify_participant` | event_id, name, pin | `boolean` | none |
| `save_availability` | event_id, name, pin, email, wants_reminder, slots `[{s,l}]` | `{participant_id}` | `name_required`, `event_not_found`, `invalid_slots`, `wrong_pin` |
| `verify_admin` | id, token | `boolean` | none |
| `finalize_event` | id, admin_token, start, end, meeting_url | void | `forbidden` |
| `delete_event` | id, admin_token | void | `forbidden` |

Frontend maps Postgres error messages (`wrong_pin`, `forbidden`, ...) to friendly text.

## Slot encoding
`s` = ISO-8601 UTC instant of slot start, `l` = 1 or 2. Slot length comes from the event. Client derives the grid from event fields; the server does not validate that a slot lies on the grid (cheap to add later if abused).

## Aggregation (client, `aggregate.ts`)
For each slot: `yes = count(l=2)`, `maybe = count(l=1)`, `score = yes + 0.5*maybe`.
Best times: sort by `yes`, then `maybe`; merge adjacent slots with identical (yes, maybe) sets into blocks; show top 5 blocks, preferring longer blocks as tiebreak.

## Deletion and retention
Events expire 180 days after last activity (`save_availability` bumps `expires_at`). Nightly pg_cron job deletes expired events, cascading to everything else. Organizer can delete early.
