import { cache } from "react";
import type { SiteSettings as SiteSettingsRow } from "@prisma/client";
import { prisma } from "./prisma";
import {
  defaultSiteSettings,
  querySiteSettingsRow,
} from "./site-settings-db";
import {
  inferSocialKindFromUrl,
  isSocialKind,
  type SocialKind,
} from "./social-link-kinds";

export type { SocialKind };
export type SocialLink = {
  id: string;
  label: string;
  url: string;
  kind: SocialKind;
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
    return v
      .map((x): SocialLink | null => {
        if (typeof x !== "object" || x === null || !("url" in x)) return null;
        const url = String((x as { url: unknown }).url).trim();
        if (!url) return null;
        const rawKind = (x as { kind?: unknown }).kind;
        const inferred = inferSocialKindFromUrl(url);
        const kind =
          isSocialKind(rawKind) && rawKind !== "other" ? rawKind : inferred;
        const rawId = (x as { id?: unknown }).id;
        const id =
          typeof rawId === "string" && rawId.trim() ? rawId.trim() : stableLegacyId(url);
        const rawLabel = (x as { label?: unknown }).label;
        const label = typeof rawLabel === "string" ? rawLabel : "";
        return { id, label, url, kind };
      })
      .filter((x): x is SocialLink => x !== null);
  } catch {
    return [];
  }
}

function stableLegacyId(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i += 1) {
    h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  }
  return `legacy-${Math.abs(h).toString(36)}`;
}

export { defaultSiteSettings };
