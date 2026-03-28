import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient();
}

/**
 * Production — один клиент на процесс (serverless-friendly).
 *
 * Development по умолчанию — новый экземпляр без global, чтобы после
 * `prisma generate` подтянулась схема без полного рестарта dev.
 *
 * `PRISMA_DEV_SINGLETON=1` — один клиент на процесс (меньше соединений к БД
 * при долгой сессии dev; после смены схемы перезапустите `next dev`).
 */
const devSingleton =
  process.env.NODE_ENV === "development" &&
  process.env.PRISMA_DEV_SINGLETON === "1";

export const prisma =
  process.env.NODE_ENV === "production" || devSingleton
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : createPrismaClient();
