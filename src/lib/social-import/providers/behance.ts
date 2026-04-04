import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { socialFetchJson, socialFetchText } from "@/lib/social-import/fetch";
import type { SocialImportPage, SocialImportProvider } from "@/lib/social-import/types";

type BehanceProject = {
  id?: number | string;
  name?: string;
  description?: string;
  url?: string;
  published_on?: number;
  covers?: Record<string, string>;
};

type BehanceListResponse = {
  projects?: BehanceProject[];
};

function cleanBehanceTitle(text: string): string {
  return text
    .replace(/^\s*Ссылка на проект\s*-\s*/i, "")
    .replace(/^\s*Project link\s*-\s*/i, "")
    .trim();
}

function pickBestFromSrcSet(srcset: string): string {
  const parts = srcset
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split(/\s+/)[0] ?? "")
    .filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function imageFromAnchor($: cheerio.CheerioAPI, el: AnyNode): string {
  const $img = $(el).find("img").first();
  const src =
    $img.attr("src")?.trim() ??
    $img.attr("data-src")?.trim() ??
    $img.attr("data-image-url")?.trim() ??
    "";
  const srcset =
    $img.attr("srcset")?.trim() ?? $img.attr("data-srcset")?.trim() ?? "";
  if (srcset) {
    const best = pickBestFromSrcSet(srcset);
    if (best) return best;
  }
  return src;
}

async function enrichProjectMeta(
  href: string,
): Promise<{ imageUrl: string; dateIso: string | null }> {
  try {
    const html = await socialFetchText(href, { timeoutMs: 10000 });
    const $ = cheerio.load(html);
    const ogImage =
      $('meta[property="og:image"]').attr("content")?.trim() ??
      $('meta[name="twitter:image"]').attr("content")?.trim() ??
      "";
    const publishedOnRaw = html.match(/"publishedOn":(\d{8,})/)?.[1] ?? "";
    const publishedOn = Number.parseInt(publishedOnRaw, 10);
    const dateIso =
      Number.isFinite(publishedOn) && publishedOn > 0
        ? new Date(publishedOn * 1000).toISOString()
        : null;
    return { imageUrl: ogImage, dateIso };
  } catch {
    return { imageUrl: "", dateIso: null };
  }
}

function pickCoverUrl(covers: Record<string, string> | undefined): string[] {
  if (!covers) return [];
  const candidates = Object.values(covers).filter(Boolean);
  return candidates.length ? [candidates[candidates.length - 1] as string] : [];
}

function mapApiProject(p: BehanceProject) {
  const href = typeof p.url === "string" ? p.url : "";
  const textParts = [
    cleanBehanceTitle(p.name?.trim() || ""),
    p.description?.trim() || "",
  ].filter(Boolean);
  const text = textParts.join("\n\n");
  const dateIso =
    typeof p.published_on === "number" && Number.isFinite(p.published_on)
      ? new Date(p.published_on * 1000).toISOString()
      : null;
  return {
    externalId: String(p.id ?? href),
    href,
    text,
    imageUrls: pickCoverUrl(p.covers),
    dateIso,
  };
}

async function previewViaApi(
  account: string,
  limit: number,
  cursor?: string | null,
): Promise<SocialImportPage> {
  const key = process.env.BEHANCE_API_KEY?.trim();
  if (!key) {
    throw new Error("BEHANCE_API_KEY не задан");
  }
  const page = cursor ? Number.parseInt(cursor, 10) : 1;
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const url =
    `https://www.behance.net/v2/users/${encodeURIComponent(account)}/projects` +
    `?api_key=${encodeURIComponent(key)}&page=${safePage}&per_page=${Math.min(limit, 24)}`;
  const json = await socialFetchJson<BehanceListResponse>(url, {
    headers: { Accept: "application/json" },
  });
  const items = (json.projects ?? [])
    .map(mapApiProject)
    .filter((i) => Boolean(i.href || i.text));
  const nextCursor = items.length >= Math.min(limit, 24) ? String(safePage + 1) : null;
  return { items, nextCursor };
}

async function previewViaScrape(
  account: string,
  limit: number,
): Promise<SocialImportPage> {
  const html = await socialFetchText(
    `https://www.behance.net/${encodeURIComponent(account)}`,
  );
  const $ = cheerio.load(html);
  const items: SocialImportPage["items"] = [];

  $("a[href*='/gallery/']").each((_, el) => {
    if (items.length >= limit) return false;
    const hrefRaw = $(el).attr("href")?.trim() ?? "";
    if (!hrefRaw.includes("/gallery/")) return;
    const href = hrefRaw.startsWith("http")
      ? hrefRaw
      : `https://www.behance.net${hrefRaw.startsWith("/") ? "" : "/"}${hrefRaw}`;
    const externalId = href.match(/\/gallery\/(\d+)/)?.[1] ?? href;
    const title = cleanBehanceTitle(
      $(el).attr("title")?.trim() || $(el).find("img").attr("alt")?.trim() || "",
    );
    const img = imageFromAnchor($, el);
    items.push({
      externalId,
      href,
      text: title,
      imageUrls: img ? [img] : [],
      dateIso: null,
    });
  });

  const unique = [
    ...new Map(items.map((i) => [`${i.externalId}:${i.href}`, i])).values(),
  ];

  // Fallback-режим: вытягиваем фото/дату из страницы проекта, если в списке их нет.
  const enriched = await Promise.all(
    unique.map(async (it) => {
      if (it.imageUrls.length > 0 && it.dateIso) return it;
      const meta = await enrichProjectMeta(it.href);
      return {
        ...it,
        imageUrls: it.imageUrls.length > 0 ? it.imageUrls : meta.imageUrl ? [meta.imageUrl] : [],
        dateIso: it.dateIso ?? meta.dateIso,
      };
    }),
  );

  return { items: enriched, nextCursor: null };
}

export const behanceProvider: SocialImportProvider = {
  platform: "behance",
  async preview({ account, limit, cursor }) {
    try {
      return await previewViaApi(account, limit, cursor);
    } catch {
      return await previewViaScrape(account, limit);
    }
  },
};
