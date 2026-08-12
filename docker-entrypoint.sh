#!/bin/sh
set -eu

# Persistent storage is empty on the first Amvera deployment and masks the
# bundled public/media directory. Seed it once, preserving later uploads.
if [ -d /app/media-seed ]; then
  cp -an /app/media-seed/. /app/public/media/ || true
fi

# Prisma migrations are versioned with the app code. Applying pending ones here
# keeps the database schema in sync on Amvera before Next starts serving traffic.
if [ -n "${DATABASE_URL:-}" ]; then
  node /app/node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"
