# Postgres with Overlap's init scripts baked in with correct permissions
# (bind-mounted files from a Mac/Windows host can be unreadable by the postgres user).
FROM postgres:16-alpine
COPY --chmod=0755 docker/initdb/00_roles.sh /docker-entrypoint-initdb.d/00_roles.sh
COPY --chmod=0644 supabase/migrations/0001_init.sql /docker-entrypoint-initdb.d/10_init.sql
COPY --chmod=0644 supabase/migrations/0003_organizer_gmail.sql /docker-entrypoint-initdb.d/11_organizer_gmail.sql
COPY --chmod=0644 supabase/migrations/0004_cleanup_after_meeting.sql /docker-entrypoint-initdb.d/12_cleanup.sql
COPY --chmod=0644 supabase/migrations/0005_feedback.sql /docker-entrypoint-initdb.d/13_feedback.sql
