#!/bin/sh
# Prepares /data, then starts Stackmap as PUID:PGID (default 1000:1000, the image's node user).
set -eu

DATA_DIR="${DATA_DIR:-/data}"
SECRET_FILE="$DATA_DIR/.auth-secret"

if [ "$(id -u)" = "0" ]; then
  # Bind mounts are often owned by root or by the host user: hand /data to the configured user.
  chown -R "$PUID:$PGID" "$DATA_DIR"
  RUN_AS="gosu $PUID:$PGID"
else
  # Started with --user: run as is; /data must already be writable by that user.
  RUN_AS=""
fi

# One-command deploy: generate the session secret once and keep it in the volume.
if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  if [ ! -s "$SECRET_FILE" ]; then
    $RUN_AS node -e "require('node:fs').writeFileSync(process.argv[1], require('node:crypto').randomBytes(32).toString('base64url'), { mode: 0o600 })" "$SECRET_FILE"
    echo "stackmap: generated a session secret in $SECRET_FILE"
  fi
  BETTER_AUTH_SECRET="$(cat "$SECRET_FILE")"
  export BETTER_AUTH_SECRET
fi

# shellcheck disable=SC2086 # RUN_AS is intentionally split into a command and its argument.
exec $RUN_AS "$@"
