#!/bin/sh
set -e

echo "=== Running Medusa migrations (kører også initial-seed-migration medmindre SKIP_INITIAL_SEED=true) ==="
npx medusa db:migrate

# Idempotent admin-user creation. Gated på BÅDE MEDUSA_ADMIN_EMAIL + MEDUSA_ADMIN_PASSWORD.
# `medusa user` skelner ikke "already exists" fra reelle fejl via exit code, så vi
# tolererer non-zero (re-run på eksisterende bruger → exit 1 = presumed-already-exists).
if [ -n "$MEDUSA_ADMIN_EMAIL" ] && [ -n "$MEDUSA_ADMIN_PASSWORD" ]; then
  echo "=== Ensuring admin user (email=$MEDUSA_ADMIN_EMAIL) ==="
  set +e
  npx medusa user -e "$MEDUSA_ADMIN_EMAIL" -p "$MEDUSA_ADMIN_PASSWORD"
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then
    echo "=== Admin user created ==="
  else
    echo "=== Admin user create exited with code $rc - presumed already exists, continuing ==="
  fi
elif [ -n "$MEDUSA_ADMIN_EMAIL" ] || [ -n "$MEDUSA_ADMIN_PASSWORD" ]; then
  echo "=== WARN: kun én af MEDUSA_ADMIN_EMAIL / MEDUSA_ADMIN_PASSWORD sat - kræver begge; skipper ==="
fi

echo "=== Starting Medusa ==="
exec npx medusa start
