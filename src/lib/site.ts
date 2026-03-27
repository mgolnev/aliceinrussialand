import type { SiteSettings as SiteSettingsRow } from "@prisma/client";
import { prisma } from "./prisma";

/** Во время `next build` Next поднимает сотни RSC-вызовов параллельно — пул Supabase не выдерживает. */
function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export type SocialLink = {
  id: string;
  label: string;
  url: string;
  kind: "telegram" | "behance" | "instagram" | "email" | "other";
};

/** Дефолты как в schema.prisma — без обращения к БД (важно для параллельного SSG на сборке). */
function defaultSiteSettings(): SiteSettingsRow {
  return {
    id: 1,
    displayName: "Иллюстратор",
    tagline: "",
    bio: "",
    aboutMarkdown: "",
    avatarMediaPath: null,
    socialLinksJson: "[]",
    telegramChannelUser: "",
    defaultLocale: "ru",
    siteUrl: "http://localhost:3000",
    plausibleDomain: "",
    yandexMetrikaId: "",
    updatedAt: new Date(0),
  };
}

export async function getSiteSettings(): Promise<SiteSettingsRow> {
  if (isNextProductionBuild()) {
    return defaultSiteSettings();
  }
  const row = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  return row ?? defaultSiteSettings();
}

/** Создать строку настроек при отсутствии — только перед записями (admin API). */
export async function ensureSiteSettings(): Promise<SiteSettingsRow> {
  return prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

/** URL превью аватарки из JSON в `SiteSettings.avatarMediaPath` (ключи w128 / w256 / w512). */
export function parseAvatarUrl(
  avatarMediaPath: string | null | undefined,
): string | null {
  if (!avatarMediaPath?.trim()) return null;
  try {
    const v = JSON.parse(avatarMediaPath) as Record<string, unknown>;
    const pick = (k: string) =>
      typeof v[k] === "string" ? (v[k] as string) : null;
    return pick("w256") ?? pick("w512") ?? pick("w128") ?? pick("w640") ?? null;
  } catch {
    return null;
  }
}

export function parseSocialLinks(json: string): SocialLink[] {
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is SocialLink =>
        typeof x === "object" &&
        x !== null &&
        "url" in x &&
        typeof (x as SocialLink).url === "string",
    ) as SocialLink[];
  } catch {
    return [];
  }
}
