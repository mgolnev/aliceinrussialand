import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function warnIfLikelyUnpooledProdDb() {
  if (process.env.NODE_ENV !== "production") return;
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) return;
  const hasPoolHints = /pgbouncer=true/i.test(raw) || /pooler\./i.test(raw);
  if (hasPoolHints) return;
  console.warn(
    "[prisma] DATABASE_URL looks unpooled. For better reliability under load, prefer a pooled connection (pgbouncer/pooler).",
  );
}

function createPrismaClient() {
  warnIfLikelyUnpooledProdDb();
  return new PrismaClient();
}

/**
 * Production — один клиент на процесс (serverless-friendly).
 *
 * Development по умолчанию — тоже singleton (устойчивее к всплескам коннектов
 * и лучше для предсказуемого TTFB). Если нужно быстро подхватить новую схему
 * без рестарта dev, можно временно выключить singleton.
 *
 * `PRISMA_DEV_SINGLETON=0` — новый экземпляр на импорт модуля в dev.
 */
const devSingletonEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.PRISMA_DEV_SINGLETON !== "0";

export const prisma =
  process.env.NODE_ENV === "production" || devSingletonEnabled
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : createPrismaClient();
