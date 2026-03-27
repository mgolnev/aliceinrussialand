#!/usr/bin/env bash
# Vercel: после сбоя миграции Prisma оставляет запись «failed» → P3009 на следующем deploy.
# Однократно снимаем маркер для известной миграции (без ошибки, если нечего снимать).
set -euo pipefail
echo ">>> prisma: P3009 recovery (failed migration marker, if any)"
npx prisma migrate resolve --rolled-back "20260327220000_yandex_metrika" 2>/dev/null || true
echo ">>> prisma migrate deploy"
npx prisma migrate deploy
echo ">>> prisma generate + next build"
npx prisma generate
npx next build
