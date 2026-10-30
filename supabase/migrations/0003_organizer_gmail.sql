-- 0003: lets the organizer's own browser send the confirmation email from their Gmail.
-- organizer_recipients: the addresses to notify (organizer only; emails are never public).
-- claim_confirmation: mark those addresses "confirmation already handled" so the worker skips them.
-- release_confirmation: undo the mark for addresses where the Gmail send failed, so the worker retries.

create or replace function public.organizer_recipients(p_id text, p_admin_token text)
returns text[]
language plpgsql stable security definer set search_path = public, extensions
as $$
declare r text[];
begin
  if not public.verify_admin(p_id, p_admin_token) then
    raise exception 'forbidden';
  end if;
  select coalesce(array_agg(distinct t.addr), '{}') into r from (
    select lower(email) as addr from public.participants
     where event_id = p_id and email is not null and email <> ''
    union
    select lower(organizer_email) from public.events
     where id = p_id and organizer_email is not null and organizer_email <> ''
  ) t;
  return r;
end;
$$;

create or replace function public.claim_confirmation(p_id text, p_admin_token text, p_emails text[])
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not public.verify_admin(p_id, p_admin_token) then
    raise exception 'forbidden';
  end if;
  insert into public.reminders_sent (event_id, final_start, offset_min, recipient)
  select p_id, ev.final_start, -1, lower(x)
    from public.events ev, unnest(p_emails) x
   where ev.id = p_id and ev.final_start is not null
  on conflict do nothing;
end;
$$;

create or replace function public.release_confirmation(p_id text, p_admin_token text, p_emails text[])
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not public.verify_admin(p_id, p_admin_token) then
    raise exception 'forbidden';
  end if;
  delete from public.reminders_sent
   where event_id = p_id
     and offset_min = -1
     and final_start = (select final_start from public.events where id = p_id)
     and recipient in (select lower(x) from unnest(p_emails) x);
end;
$$;

grant execute on function
  public.organizer_recipients(text, text),
  public.claim_confirmation(text, text, text[]),
  public.release_confirmation(text, text, text[])
to anon, authenticated;
