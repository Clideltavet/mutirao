#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PG_BIN="${DELTA_PG_BIN:-$PWD/node_modules/@embedded-postgres/linux-x64/native/bin}"
TEST_DIR=$(mktemp -d /tmp/delta-vet-test.XXXXXX)
cleanup(){ cp "$TEST_DIR/next.log" tests/evidence/server.log 2>/dev/null || true; if [ -n "${NEXT_PID:-}" ]; then kill "$NEXT_PID" 2>/dev/null || true; fi; "$PG_BIN/pg_ctl" -D "$TEST_DIR/db" -m fast stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$PG_BIN/initdb" -D "$TEST_DIR/db" -A trust -U delta_test > "$TEST_DIR/init.log"
"$PG_BIN/pg_ctl" -D "$TEST_DIR/db" -l "$TEST_DIR/postgres.log" -o "-h 127.0.0.1 -p 55432 -c unix_socket_directories=''" start
export DELTA_TEST_URL=postgres://delta_test@127.0.0.1:55432/delta_test
node tests/setup.mjs
node tests/integration.mjs
"$PG_BIN/pg_ctl" -D "$TEST_DIR/db" -m fast restart -l "$TEST_DIR/postgres.log"
if [ "${1:-}" = '--database-only' ]; then exit 0; fi
npm run build > tests/evidence/build.log 2>&1
DATABASE_URL="$DELTA_TEST_URL" DELTA_ISOLATED_TEST=1 npm start -- --hostname 127.0.0.1 --port 3000 > "$TEST_DIR/next.log" 2>&1 &
NEXT_PID=$!
node tests/browser-real.mjs
cp "$TEST_DIR/next.log" tests/evidence/server.log
