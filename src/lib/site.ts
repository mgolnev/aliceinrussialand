import { cache } from "react";
import type { SiteSettings as SiteSettingsRow } from "@prisma/client";
import { prisma } from "./prisma";
import {
  defaultSiteSettings,
  querySiteSettingsRow,
} from "./site-settings-db";

export type SocialLink = {
  id: string;
  label: string;
  url: string;
  kind: "telegram" | "behance" | "instagram" | "email" | "other";
};

/** Одно чтение настроек на запрос React (RSC): дедуп в layout + page + generateMetadata. */
export const getSiteSettings = cache(querySiteSettingsRow);

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

export function parseAboutPhotoUrl(
  aboutPhotoPath: string | null | undefined,
): string | null {
  if (!aboutPhotoPath?.trim()) return null;
  try {
    const v = JSON.parse(aboutPhotoPath) as Record<string, unknown>;
    const pick = (k: string) =>
      typeof v[k] === "string" ? (v[k] as string) : null;
    return pick("w1280") ?? pick("w960") ?? pick("w640") ?? null;
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

export { defaultSiteSettings };
