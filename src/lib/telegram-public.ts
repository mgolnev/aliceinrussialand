import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { isTelegramProxyConfigured, telegramFetch } from "@/lib/telegram-fetch";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];

function pageHeaders(attempt: number): Record<string, string> {
  const ua = USER_AGENTS[attempt % USER_AGENTS.length];
  return {
    "User-Agent": ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };
}

function mediaHeaders(attempt: number): Record<string, string> {
  const ua = USER_AGENTS[attempt % USER_AGENTS.length];
  return {
    "User-Agent": ua,
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: "https://t.me/",
  };
}

function proxyHint(): string {
  return isTelegramProxyConfigured()
    ? ""
    : " На продакшене с IP датацентра (например Vercel) задайте TELEGRAM_OUTBOUND_PROXY — см. .env.example.";
}

function shouldRetryHttpStatus(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}

function looksLikeBotChallenge(html: string): boolean {
  return /cf-browser-verification|challenge-platform|Just a moment|AccessDenied/i.test(
    html,
  );
}

async function fetchTelegramChannelHtml(url: string): Promise<string> {
  const attempts = 3;
  const timeoutMs = 4500;
  let lastFail = "";

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 350 + i * 350));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await telegramFetch(url, {
        cache: "no-store",
        redirect: "follow",
        headers: pageHeaders(i),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 404) {
        throw new Error("Канал не найден (404). Проверьте username.");
      }

      if (!res.ok) {
        lastFail = `Telegram вернул ${res.status}`;
        if (shouldRetryHttpStatus(res.status) && i < attempts - 1) {
          continue;
        }
        throw new Error(`${lastFail}.${proxyHint()}`);
      }

      const html = await res.text();

      if (html.includes("tgme_widget_message")) {
        return html;
      }

      lastFail = "Нет разметки постов на странице";
      if (looksLikeBotChallenge(html) && i < attempts - 1) {
        continue;
      }
      throw new Error(
        `Не удалось разобрать страницу канала (возможна блокировка IP).${proxyHint()}`,
      );
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof Error && e.message.startsWith("Канал не найден")) {
        throw e;
      }
      if (
        e instanceof Error &&
        (e.message.includes("блокировка IP") ||
          e.message.includes("Telegram вернул"))
      ) {
        throw e;
      }
      const aborted = e instanceof Error && e.name === "AbortError";
      if (aborted) {
        lastFail = "Таймаут";
        if (i < attempts - 1) continue;
        throw new Error(`Таймаут при обращении к t.me.${proxyHint()}`);
      }
      lastFail = e instanceof Error ? e.message : String(e);
      if (i < attempts - 1) continue;
      throw new Error(`${lastFail}${proxyHint()}`);
    }
  }

  throw new Error((lastFail || "Не удалось загрузить канал") + proxyHint());
}

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
 * Работает только для открытых каналов. Несколько попыток, опциональный исходящий прокси.
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

  const html = await fetchTelegramChannelHtml(url);
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
  const attempts = 2;
  const timeoutMs = 20000;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await telegramFetch(url, {
        cache: "no-store",
        redirect: "follow",
        headers: mediaHeaders(i),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        if (shouldRetryHttpStatus(res.status) && i < attempts - 1) {
          continue;
        }
        throw new Error(`Не удалось скачать изображение: ${res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      clearTimeout(timer);
      const aborted = e instanceof Error && e.name === "AbortError";
      if (aborted && i < attempts - 1) continue;
      if (aborted) {
        throw new Error(`Таймаут при скачивании изображения.${proxyHint()}`);
      }
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(`Не удалось скачать изображение.${proxyHint()}`);
}
