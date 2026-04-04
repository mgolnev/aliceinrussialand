import { NextResponse } from "next/server";
import { fetchPublicChannelMessages } from "@/lib/telegram-public";
import { getSiteSettings } from "@/lib/site";
import { DEFAULT_TELEGRAM_CHANNEL } from "@/lib/telegram-default";
import { prisma } from "@/lib/prisma";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";

export const runtime = "nodejs";
/** Ретраи к t.me; на Pro можно до 60s, на Hobby Vercel усечёт по плану. */
export const maxDuration = 45;

function isSourceFieldsCompatError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("sourcePlatform") ||
    msg.includes("sourceUrl") ||
    msg.includes("Unknown arg") ||
    msg.includes("does not exist in the current database")
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    channelUser?: string;
    limit?: number;
    before?: string | null;
  } | null;

  const settings = await getSiteSettings();
  const channelUser =
    body?.channelUser?.replace(/^@/, "").trim() ||
    settings.telegramChannelUser.trim() ||
    DEFAULT_TELEGRAM_CHANNEL;

  if (!channelUser) {
    return NextResponse.json(
      {
        error: "Укажите username канала в настройках или в запросе (без @)",
      },
      { status: 400 },
    );
  }

  try {
    const result = await fetchPublicChannelMessages(
      channelUser,
      Math.min(body?.limit ?? 25, 40),
      body?.before ?? null,
    );

    const norms = [
      ...new Set(
        result.items.map((i) => normalizeTelegramPostUrl(i.href)).filter(Boolean),
      ),
    ];
    const expanded =
      norms.length > 0
        ? [...new Set(norms.flatMap((n) => [n, `${n}/`]))]
        : [];

    let importedHrefs: string[] = [];
    if (expanded.length) {
      const rows = await (async () => {
        try {
          return await prisma.post.findMany({
            where: {
              OR: [
                { telegramSourceUrl: { in: expanded } },
                { sourcePlatform: "TELEGRAM", sourceUrl: { in: expanded } },
              ],
            },
            select: { telegramSourceUrl: true, sourceUrl: true },
          });
        } catch (e) {
          if (!isSourceFieldsCompatError(e)) throw e;
          // Совместимость со старыми Prisma Client/БД без sourcePlatform/sourceUrl.
          const legacy = await prisma.post.findMany({
            where: { telegramSourceUrl: { in: expanded } },
            select: { telegramSourceUrl: true },
          });
          return legacy.map((r) => ({
            telegramSourceUrl: r.telegramSourceUrl,
            sourceUrl: null,
          }));
        }
      })();
      importedHrefs = [
        ...new Set(
          rows
            .map((r) =>
              r.telegramSourceUrl || r.sourceUrl
                ? normalizeTelegramPostUrl(r.telegramSourceUrl || r.sourceUrl || "")
                : "",
            )
            .filter(Boolean),
        ),
      ];
    }

    return NextResponse.json({
      channelUser,
      ...result,
      importedHrefs,
    });
  } catch (e) {
    const msg = "Ошибка загрузки списка Telegram.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
