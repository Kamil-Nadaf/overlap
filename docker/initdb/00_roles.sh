#!/bin/sh
# Creates the roles/schema that Supabase provides, so supabase/migrations/0001_init.sql runs unchanged
# on plain Postgres. PostgREST connects as `authenticator` and switches to `anon`.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
create schema if not exists extensions;
do \$\$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password '${AUTHENTICATOR_PASSWORD}';
  end if;
end
\$\$;
grant anon, authenticated to authenticator;
grant usage on schema public, extensions to anon, authenticated;
EOSQL
