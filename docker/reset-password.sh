#!/bin/sh
# reset-password <email>: a new temporary password for a locked-out account (server/cli/reset-password.ts).
# `docker compose exec` runs as root by default: run as PUID:PGID, as the server does, so /data keeps its owner.
set -eu

cd /app
if [ "$(id -u)" = "0" ]; then
  exec gosu "$PUID:$PGID" node .output/server/cli/reset-password.mjs "$@"
fi
exec node .output/server/cli/reset-password.mjs "$@"
