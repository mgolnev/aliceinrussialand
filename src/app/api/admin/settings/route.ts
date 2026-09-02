import { after, NextResponse } from "next/server";
import { ensureSiteSettings, getSiteSettings } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { notifyIndexNowPaths } from "@/lib/indexnow";

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
  if (str("authorName") !== undefined) {
    data.authorName = (str("authorName") ?? "").trim().slice(0, 100);
  }
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
  if (str("contactsLabel") !== undefined) {
    data.contactsLabel = str("contactsLabel") ?? "";
  }
  if (str("defaultLocale") !== undefined) {
    data.defaultLocale = str("defaultLocale");
  }
  if (str("siteUrl") !== undefined) data.siteUrl = str("siteUrl");
  if (str("seoTitle") !== undefined) {
    data.seoTitle = (str("seoTitle") ?? "").trim().slice(0, 70);
  }
  if (str("seoDescription") !== undefined) {
    data.seoDescription = (str("seoDescription") ?? "").trim().slice(0, 160);
  }
  if (str("plausibleDomain") !== undefined) {
    data.plausibleDomain = str("plausibleDomain");
  }
  if (str("yandexMetrikaId") !== undefined) {
    const raw = str("yandexMetrikaId") ?? "";
    data.yandexMetrikaId = raw.replace(/\D/g, "");
  }
  if (str("yandexVerification") !== undefined) {
    data.yandexVerification = (str("yandexVerification") ?? "").trim();
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей" }, { status: 400 });
  }

  await ensureSiteSettings();

  const updated = await prisma.siteSettings.update({
    where: { id: 1 },
    data: data as Parameters<typeof prisma.siteSettings.update>[0]["data"],
  });
  after(() => notifyIndexNowPaths(["/", "/about"]));
  return NextResponse.json(updated);
}
