import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

export type TelegramPublicMessage = {
  messageId: string;
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
};

export type TelegramPublicPage = {
  items: TelegramPublicMessage[];
  nextBefore: string | null;
};

function collectStyleUrls(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
) {
  const urls: string[] = [];

  root
    .find(
      ".tgme_widget_message_photo_wrap, .tgme_widget_message_grouped_layer, .tgme_widget_message_grouped_layer_wrap",
    )
    .each((_, el) => {
      const style = $(el).attr("style") ?? "";
      const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (match?.[1]) {
        urls.push(match[1]);
      }
    });

  return urls;
}

function collectImageTags(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
) {
  const urls: string[] = [];

  root
    .find(
      ".tgme_widget_message_media_wrap img, .tgme_widget_message_photo_wrap img, .tgme_widget_message_grouped_layer img",
    )
    .each((_, img) => {
      const src = $(img).attr("src")?.trim();
      if (!src || src.startsWith("data:")) return;
      if (/emoji|sticker|avatar|userpic/i.test(src)) return;
      urls.push(src);
    });

  return urls;
}

/**
 * Парсинг публичной витрины канала https://t.me/s/username (без Bot API).
 * Работает только для открытых каналов.
 */
export async function fetchPublicChannelMessages(
  channelUser: string,
  limit = 25,
  before?: string | null,
): Promise<TelegramPublicPage> {
  const user = channelUser.replace(/^@/, "").trim();
  if (!user) return { items: [], nextBefore: null };

  const baseUrl = `https://t.me/s/${encodeURIComponent(user)}`;
  const url = before ? `${baseUrl}?before=${encodeURIComponent(before)}` : baseUrl;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AliceInRussialand/1.0; +https://example.com)",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`Telegram вернул ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const out: TelegramPublicMessage[] = [];
  const prevHref = $('link[rel="prev"]').attr("href") ?? "";
  const nextBefore =
    prevHref.match(/[?&]before=(\d+)/)?.[1] ??
    prevHref.match(/before=(\d+)/)?.[1] ??
    null;

  $(".tgme_widget_message").each((_, el) => {
    if (out.length >= limit) return false;

    const $el = $(el);
    const dataPost = $el.attr("data-post");
    const dateA = $el.find(".tgme_widget_message_date").first();
    const href = dateA.attr("href")?.trim() ?? "";
    const timeEl = dateA.find("time");
    const datetime = timeEl.attr("datetime") ?? null;

    const text = $el.find(".tgme_widget_message_text").text().trim();

    const imageUrls = [
      ...collectStyleUrls($, $el),
      ...collectImageTags($, $el),
    ];

    const messageId =
      dataPost ?? href.split("/").filter(Boolean).pop() ?? "";

    if (!href && !text && imageUrls.length === 0) return;

    out.push({
      messageId: messageId || href,
      href: href || `https://t.me/${user}`,
      text,
      imageUrls: [...new Set(imageUrls)],
      dateIso: datetime,
    });
    return;
  });

  return { items: out, nextBefore };
}

export async function downloadTelegramImage(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AliceInRussialand/1.0; +https://example.com)",
    },
  });
  if (!res.ok) throw new Error(`Не удалось скачать изображение: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}
