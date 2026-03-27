import { NextResponse } from "next/server";
import { fetchPublicChannelMessages } from "@/lib/telegram-public";
import { getSiteSettings } from "@/lib/site";
import { DEFAULT_TELEGRAM_CHANNEL } from "@/lib/telegram-default";

export const runtime = "nodejs";

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
    return NextResponse.json({ channelUser, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка загрузки";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
