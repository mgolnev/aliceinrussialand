import * as cheerio from "cheerio";
import { socialFetchText } from "@/lib/social-import/fetch";
import type { SocialImportItem, SocialImportPage } from "@/lib/social-import/types";

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 450;

const urlCache = new Map<string, { ts: number; item: SocialImportItem }>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeInputUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    u.hash = "";
    if (!/instagram\.com$/i.test(u.hostname) && !/instagram\.com$/i.test(u.hostname.replace(/^www\./i, ""))) {
      return "";
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return "";
    let typeIdx = 0;
    if (["p", "reel", "tv"].includes(parts[0] ?? "")) {
      typeIdx = 0;
    } else if (parts.length >= 3 && ["p", "reel", "tv"].includes(parts[1] ?? "")) {
      // Поддержка URL вида /username/p/<shortcode>/...
      typeIdx = 1;
    } else {
      return "";
    }
    u.search = "";
    u.pathname = `/${parts[typeIdx]}/${parts[typeIdx + 1]}/`;
    return u.toString();
  } catch {
    return "";
  }
}

function externalIdFromUrl(url: string): string {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return m?.[1] ?? url;
}

function parsePostMeta(html: string, fallbackUrl: string): SocialImportItem {
  const $ = cheerio.load(html);
  const href =
    $('meta[property="og:url"]').attr("content")?.trim() || fallbackUrl;
  const image =
    $('meta[property="og:image"]').attr("content")?.trim() ||
    $('meta[name="twitter:image"]').attr("content")?.trim() ||
    "";
  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    "";
  const uploadDate =
    html.match(/"uploadDate":"([^"]+)"/)?.[1] ??
    $('meta[property="article:published_time"]').attr("content")?.trim() ??
    null;
  return {
    externalId: externalIdFromUrl(href),
    href,
    text: description,
    imageUrls: image ? [image] : [],
    dateIso: uploadDate || null,
  };
}

async function fetchSingleWithRetry(url: string): Promise<SocialImportItem> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const html = await socialFetchText(url, {
        timeoutMs: 12000 + attempt * 3000,
        headers: {
          Referer: "https://www.instagram.com/",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      return parsePostMeta(html, url);
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isRate = msg.includes("HTTP 429") || msg.includes("HTTP 403");
      if (attempt < 2 && isRate) {
        await sleep(700 * (attempt + 1));
        continue;
      }
      if (attempt < 2) {
        await sleep(350 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function previewInstagramByUrls(
  rawUrls: string[],
  limit: number,
): Promise<SocialImportPage> {
  const normalized = [
    ...new Set(rawUrls.map(normalizeInputUrl).filter(Boolean)),
  ].slice(0, Math.max(1, Math.min(limit, 20)));
  if (!normalized.length) {
    throw new Error(
      "Не удалось распознать ссылки Instagram. Используйте формат https://www.instagram.com/p/<shortcode>/ или /reel/<shortcode>/.",
    );
  }

  const items: SocialImportItem[] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const url = normalized[i]!;
    const cached = urlCache.get(url);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      items.push(cached.item);
      continue;
    }
    if (i > 0) await sleep(REQUEST_COOLDOWN_MS);
    try {
      const item = await fetchSingleWithRetry(url);
      urlCache.set(url, { ts: Date.now(), item });
      items.push(item);
    } catch {
      // Пропускаем битые URL, не валим весь список.
    }
  }

  if (!items.length) {
    throw new Error(
      "По указанным ссылкам Instagram не удалось получить данные (возможно, временная блокировка или приватный пост).",
    );
  }

  return { items, nextCursor: null };
}
