#!/usr/bin/env bash
# Applies every migration to a throwaway local PostgreSQL 16 (with stubbed
# Supabase auth/storage schemas) and runs the RLS test suite.
# Usage: supabase/tests/run.sh   (PG_BIN defaults to /usr/lib/postgresql/16/bin)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
if [ "$(id -u)" = 0 ]; then
  chown postgres "$WORK"; chmod a+rx "$HERE" "$HERE/../migrations" "$HERE/../.." 2>/dev/null || true
  RUN() { su postgres -s /bin/bash -c "$*"; }
else
  RUN() { bash -c "$*"; }
fi
cleanup() { RUN "'$PG_BIN/pg_ctl' -D '$WORK/data' -m immediate stop >/dev/null 2>&1" || true; rm -rf "$WORK"; }
trap cleanup EXIT
RUN "'$PG_BIN/initdb' -D '$WORK/data' -A trust -U postgres >/dev/null"
RUN "'$PG_BIN/pg_ctl' -D '$WORK/data' -o \"-p $PORT -k $WORK -c listen_addresses=''\" -l '$WORK/log' -w start >/dev/null"
# Fixtures insert workspaces and users directly, so the sessions start with the "accounts must match" checks off; accounts_match.sql turns them back on.
PSQL="PGOPTIONS='-c adflo.test_fixture=on' '$PG_BIN/psql' -h '$WORK' -p $PORT -U postgres -v ON_ERROR_STOP=1 -X -q"
RUN "$PSQL -d postgres -c 'create database dms'"
RUN "$PSQL -d dms -f '$HERE/stubs.sql'"
for f in "$HERE"/../migrations/*.sql; do
  echo "applying $(basename "$f")"
  RUN "$PSQL -d dms -f '$f'"
done
RUN "$PSQL -d dms -f '$HERE/rls.sql'" 2>&1 | grep -E "PASS|FAIL|ALL RLS|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/control.sql'" 2>&1 | grep -E "PASS|FAIL|ALL CONTROL|ALL WORKSPACE|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/control2.sql'" 2>&1 | grep -E "PASS|FAIL|ALL CONTROL2|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/control3.sql'" 2>&1 | grep -E "PASS|FAIL|ALL CONTROL3|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/control4.sql'" 2>&1 | grep -E "PASS|FAIL|ALL CONTROL4|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/control5.sql'" 2>&1 | grep -E "PASS|FAIL|ALL CONTROL5|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/records.sql'" 2>&1 | grep -E "PASS|FAIL|ALL RECORDS|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/open_items.sql'" 2>&1 | grep -E "PASS|FAIL|ALL OPEN ITEMS|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/more_records.sql'" 2>&1 | grep -E "PASS|FAIL|ALL MORE RECORDS|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/suspend.sql'" 2>&1 | grep -E "PASS|FAIL|ALL SUSPEND|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/onboarding_steps.sql'" 2>&1 | grep -E "PASS|FAIL|ALL ONBOARDING|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/job_runs.sql'" 2>&1 | grep -E "PASS|FAIL|ALL JOB RUNS|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/workspace_deletion.sql'" 2>&1 | grep -E "PASS|FAIL|ALL WORKSPACE DELETION|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/usage.sql'" 2>&1 | grep -E "PASS|FAIL|ALL USAGE|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/seats.sql'" 2>&1 | grep -E "PASS|FAIL|ALL SEATS|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/storage_plan.sql'" 2>&1 | grep -E "PASS|FAIL|ALL STORAGE PLAN|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/accounts_match.sql'" 2>&1 | grep -E "PASS|FAIL|ALL ACCOUNTS|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/client_workspace_delete.sql'" 2>&1 | grep -E "PASS|FAIL|ALL CLIENT WORKSPACE DELETE|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/orphan_workspace_delete.sql'" 2>&1 | grep -E "PASS|FAIL|ALL ORPHAN WORKSPACE DELETE|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/client_delete_all.sql'" 2>&1 | grep -E "PASS|FAIL|ALL CLIENT DELETE ALL|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/support.sql'" 2>&1 | grep -E "PASS|FAIL|ALL SUPPORT|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/stray_accounts.sql'" 2>&1 | grep -E "PASS|FAIL|ALL STRAY ACCOUNTS|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/calendar_feed.sql'" 2>&1 | grep -E "PASS|FAIL|ALL CALENDAR FEED|ERROR" | sed 's/^psql:[^ ]* //'
RUN "$PSQL -d dms -f '$HERE/automation_activity.sql'" 2>&1 | grep -E "PASS|FAIL|ALL AUTOMATION ACTIVITY|ERROR" | sed 's/^psql:[^ ]* //'
