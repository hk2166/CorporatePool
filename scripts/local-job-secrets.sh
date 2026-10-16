#!/usr/bin/env bash
# Lets the local database call this app's job routes (/api/jobs/*), such as the push sender
# (T-6.3): stores the app's address and CRON_SECRET (from .env.local) in the local Supabase
# Vault. Run it once after `npm run db:start` or `npm run db:reset`:
#
#   npm run jobs:local
#
# The database runs in Docker, so "localhost" there isn't your machine; host.docker.internal
# is. For the hosted project, set the same two secrets once in the SQL editor (docs/setup.md).

set -euo pipefail

DB="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
APP_URL="${APP_URL:-http://host.docker.internal:3000}"
SECRET="$(grep -E '^CRON_SECRET=' .env.local 2>/dev/null | cut -d= -f2- || true)"

if [[ -z "$SECRET" ]]; then
  echo "CRON_SECRET isn't set in .env.local. Generate one: openssl rand -hex 32" >&2
  exit 1
fi

psql "$DB" -v ON_ERROR_STOP=1 -qtAX -v app_url="$APP_URL" -v secret="$SECRET" <<'SQL'
delete from vault.secrets where name in ('app_url', 'cron_secret');
select vault.create_secret(:'app_url', 'app_url');
select vault.create_secret(:'secret', 'cron_secret');
SQL
echo "Local database will call $APP_URL/api/jobs/* with CRON_SECRET."
