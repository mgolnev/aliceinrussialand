#!/bin/sh
set -eu

# Persistent storage is empty on the first Amvera deployment and masks the
# bundled public/media directory. Seed it once, preserving later uploads.
if [ -d /app/media-seed ]; then
  cp -an /app/media-seed/. /app/public/media/ || true
fi

exec "$@"
