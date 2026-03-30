import { NextResponse } from "next/server";
import { fetchPublicChannelMessages } from "@/lib/telegram-public";
import { getSiteSettings } from "@/lib/site";
import { DEFAULT_TELEGRAM_CHANNEL } from "@/lib/telegram-default";
import { prisma } from "@/lib/prisma";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";

export const runtime = "nodejs";
/** Ретраи к t.me; на Pro можно до 60s, на Hobby Vercel усечёт по плану. */
export const maxDuration = 45;

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
      const rows = await prisma.post.findMany({
        where: { telegramSourceUrl: { in: expanded } },
        select: { telegramSourceUrl: true },
      });
      importedHrefs = [
        ...new Set(
          rows
            .map((r) =>
              r.telegramSourceUrl
                ? normalizeTelegramPostUrl(r.telegramSourceUrl)
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
    const msg = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
