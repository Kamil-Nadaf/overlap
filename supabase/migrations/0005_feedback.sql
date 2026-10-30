-- 0005: anonymous feedback from the site. Anyone can send; nobody can read it through the public API.
-- Read it in the Supabase Table Editor (public.feedback), or set FEEDBACK_TO on the worker to get it by email.

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message    text not null check (char_length(message) between 3 and 2000),
  contact    text check (char_length(contact) <= 200),
  page       text check (char_length(page) <= 200),
  notified   boolean not null default false
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.send_feedback(p_message text, p_contact text default null, p_page text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- crude flood guard: at most 30 messages per hour across the whole site
  if (select count(*) from public.feedback where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many';
  end if;
  insert into public.feedback (message, contact, page)
  values (btrim(p_message), nullif(btrim(coalesce(p_contact, '')), ''), nullif(left(coalesce(p_page, ''), 200), ''));
end;
$$;

grant execute on function public.send_feedback(text, text, text) to anon, authenticated;
