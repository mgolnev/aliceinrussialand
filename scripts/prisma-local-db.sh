#!/usr/bin/env bash
# Локальный Postgres из docker-compose.yml (user/db из compose).
# Prisma CLI не подхватывает .env.local — задаём URL здесь.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/alice}"
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
cd "$ROOT"
npx prisma migrate deploy
npx prisma db seed
