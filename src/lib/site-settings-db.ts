import type { SiteSettings as SiteSettingsRow } from "@prisma/client";
import { prisma } from "./prisma";
import { DEFAULT_WANDER_ENTRY_LABEL, DEFAULT_WANDER_ENTRY_SUBTITLE } from "./wander-settings";

export function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Дефолты как в schema.prisma — без обращения к БД (важно для параллельного SSG на сборке). */
export function defaultSiteSettings(): SiteSettingsRow {
  return {
    id: 1,
    displayName: "Иллюстратор",
    authorName: "",
    tagline: "",
    bio: "",
    aboutMarkdown: "",
    avatarMediaPath: null,
    aboutPhotoPath: null,
    socialLinksJson: "[]",
    telegramChannelUser: "",
    contactsLabel: "Контакты",
    defaultLocale: "ru",
    siteUrl: "http://localhost:3000",
    seoTitle: "",
    seoDescription: "",
    plausibleDomain: "",
    yandexMetrikaId: "",
    yandexVerification: "",
    showWanderEntry: true,
    wanderEntryLabel: DEFAULT_WANDER_ENTRY_LABEL,
    wanderEntrySubtitle: DEFAULT_WANDER_ENTRY_SUBTITLE,
    updatedAt: new Date(0),
  };
}

/** Одно чтение строки настроек из БД (без React.cache). Для тестов и внутренних вызовов. */
export async function querySiteSettingsRow(): Promise<SiteSettingsRow> {
  if (isNextProductionBuild()) {
    return defaultSiteSettings();
  }
  const row = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  return row ?? defaultSiteSettings();
}
