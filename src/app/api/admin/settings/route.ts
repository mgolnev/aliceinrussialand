import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const s = await getSiteSettings();
  return NextResponse.json(s);
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const str = (k: string) =>
    typeof body[k] === "string" ? (body[k] as string) : undefined;

  if (str("displayName") !== undefined) data.displayName = str("displayName");
  if (str("tagline") !== undefined) data.tagline = str("tagline");
  if (str("bio") !== undefined) data.bio = str("bio");
  if (str("aboutMarkdown") !== undefined) {
    data.aboutMarkdown = str("aboutMarkdown");
  }
  if (str("socialLinksJson") !== undefined) {
    data.socialLinksJson = str("socialLinksJson");
  }
  if (str("telegramChannelUser") !== undefined) {
    data.telegramChannelUser = str("telegramChannelUser")?.replace(/^@/, "");
  }
  if (str("defaultLocale") !== undefined) {
    data.defaultLocale = str("defaultLocale");
  }
  if (str("siteUrl") !== undefined) data.siteUrl = str("siteUrl");
  if (str("plausibleDomain") !== undefined) {
    data.plausibleDomain = str("plausibleDomain");
  }
  if (str("gaMeasurementId") !== undefined) {
    data.gaMeasurementId = str("gaMeasurementId");
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей" }, { status: 400 });
  }

  const updated = await prisma.siteSettings.update({
    where: { id: 1 },
    data: data as Parameters<typeof prisma.siteSettings.update>[0]["data"],
  });
  return NextResponse.json(updated);
}
