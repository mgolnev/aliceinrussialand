#!/usr/bin/env bash
# Vercel: после сбоя миграции Prisma оставляет запись «failed» → P3009 на следующем deploy.
# Однократно снимаем маркер для известной миграции (без ошибки, если нечего снимать).
set -euo pipefail
echo ">>> prisma: P3009 recovery (failed migration marker, if any)"
npx prisma migrate resolve --rolled-back "20260327220000_yandex_metrika" 2>/dev/null || true

echo ">>> prisma: reconcile 20260401121000_post_category_description state"
HAS_CATEGORY_DESCRIPTION_COLUMN="$(
node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2) AS "exists"',
      "PostCategory",
      "description",
    );
    process.stdout.write(rows?.[0]?.exists ? "1" : "0");
  } catch {
    process.stdout.write("0");
  } finally {
    await prisma.$disconnect();
  }
})();
NODE
)"

if [ "$HAS_CATEGORY_DESCRIPTION_COLUMN" = "1" ]; then
  echo ">>> prisma: description column exists, marking migration as applied"
  npx prisma migrate resolve --applied "20260401121000_post_category_description" 2>/dev/null || true
else
  echo ">>> prisma: description column missing, keeping migration deployable"
  npx prisma migrate resolve --rolled-back "20260401121000_post_category_description" 2>/dev/null || true
fi

echo ">>> prisma migrate deploy"
npx prisma migrate deploy
echo ">>> prisma generate + next build"
npx prisma generate
npx next build
