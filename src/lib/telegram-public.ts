import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { isTelegramProxyConfigured, telegramFetch } from "@/lib/telegram-fetch";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

function pickUA(idx: number): string {
  return USER_AGENTS[idx % USER_AGENTS.length];
}

function proxyHint(): string {
  return isTelegramProxyConfigured()
    ? ""
    : " Также можно задать TELEGRAM_OUTBOUND_PROXY — см. .env.example.";
}

function shouldRetry(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}

// ---------------------------------------------------------------------------
// Стратегии получения HTML с постами канала
// ---------------------------------------------------------------------------

type FetchResult =
  | { ok: true; html: string; nextBefore: string | null }
  | { ok: false; reason: string };

/**
 * Стратегия 1: AJAX-запрос.
 * Telegram отдаёт JSON `{"html":"<div class='tgme_channel_history'>…</div>"}`,
 * если послать `X-Requested-With: XMLHttpRequest`. Этот эндпоинт используется
 * скроллом на странице канала и предназначен для программных запросов —
 * менее агрессивно блокируется.
 */
async function fetchViaAjax(
  user: string,
  before: string | null,
  attempt: number,
): Promise<FetchResult> {
  const base = `https://t.me/s/${encodeURIComponent(user)}`;
  const url = before ? `${base}?before=${encodeURIComponent(before)}` : base;
  const ua = pickUA(attempt);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await telegramFetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": ua,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: `https://t.me/s/${encodeURIComponent(user)}`,
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    clearTimeout(timer);

    if (res.status === 404) return { ok: false, reason: "404" };
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();

    let html: string;
    if (contentType.includes("json") || text.trimStart().startsWith("{")) {
      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        html = typeof json.html === "string" ? json.html : "";
      } catch {
        return { ok: false, reason: "Невалидный JSON" };
      }
    } else {
      html = text;
    }

    if (!html.includes("tgme_widget_message")) {
      return { ok: false, reason: "Нет постов в AJAX-ответе" };
    }

    const $ = cheerio.load(html);
    const prevHref = $('link[rel="prev"]').attr("href") ?? "";
    const nextBefore =
      prevHref.match(/[?&]before=(\d+)/)?.[1] ??
      prevHref.match(/before=(\d+)/)?.[1] ??
      null;

    return { ok: true, html, nextBefore };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error && e.name === "AbortError" ? "Таймаут (AJAX)" : String(e);
    return { ok: false, reason: msg };
  }
}

/**
 * Стратегия 2/3: обычный GET на полную страницу.
 * `domain` позволяет переключаться между t.me и telegram.me.
 */
async function fetchViaFullPage(
  user: string,
  before: string | null,
  attempt: number,
  domain: "t.me" | "telegram.me",
): Promise<FetchResult> {
  const base = `https://${domain}/s/${encodeURIComponent(user)}`;
  const url = before ? `${base}?before=${encodeURIComponent(before)}` : base;
  const ua = pickUA(attempt);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await telegramFetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      },
    });
    clearTimeout(timer);

    if (res.status === 404) return { ok: false, reason: "404" };
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status} (${domain})` };

    const html = await res.text();

    if (!html.includes("tgme_widget_message")) {
      return { ok: false, reason: `Нет постов (${domain})` };
    }

    const $ = cheerio.load(html);
    const prevHref = $('link[rel="prev"]').attr("href") ?? "";
    const nextBefore =
      prevHref.match(/[?&]before=(\d+)/)?.[1] ??
      prevHref.match(/before=(\d+)/)?.[1] ??
      null;

    return { ok: true, html, nextBefore };
  } catch (e) {
    clearTimeout(timer);
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? `Таймаут (${domain})`
        : String(e);
    return { ok: false, reason: msg };
  }
}

/**
 * Пробует загрузить HTML с постами канала через несколько стратегий.
 * Порядок: AJAX → full page t.me → full page telegram.me
 */
async function fetchChannelHtml(
  user: string,
  before: string | null,
): Promise<{ html: string; nextBefore: string | null }> {
  const errors: string[] = [];
  let attempt = 0;

  // --- 1. AJAX (2 попытки) ---
  for (let i = 0; i < 2; i++) {
    const r = await fetchViaAjax(user, before, attempt++);
    if (r.ok) return { html: r.html, nextBefore: r.nextBefore };
    if (r.reason === "404") {
      throw new Error("Канал не найден (404). Проверьте username.");
    }
    errors.push(`AJAX[${i}]: ${r.reason}`);
    if (i === 0) await pause(400);
  }

  // --- 2. Full page t.me (2 попытки) ---
  for (let i = 0; i < 2; i++) {
    const r = await fetchViaFullPage(user, before, attempt++, "t.me");
    if (r.ok) return { html: r.html, nextBefore: r.nextBefore };
    if (r.reason === "404") {
      throw new Error("Канал не найден (404). Проверьте username.");
    }
    errors.push(`t.me[${i}]: ${r.reason}`);
    if (i === 0) await pause(500);
  }

  // --- 3. Full page telegram.me (1 попытка) ---
  {
    const r = await fetchViaFullPage(user, before, attempt++, "telegram.me");
    if (r.ok) return { html: r.html, nextBefore: r.nextBefore };
    errors.push(`telegram.me: ${r.reason}`);
  }

  throw new Error(
    `Не удалось загрузить канал @${user} ни одним способом ` +
      `(${errors.join("; ")}).${proxyHint()}`,
  );
}

function pause(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Типы и парсинг
// ---------------------------------------------------------------------------

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
      if (match?.[1]) urls.push(match[1]);
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

function normalizeWs(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Если весь текст — две подряд одинаковые части (частая вёрстка: два .tgme_widget_message_text
 * или один блок, продублированный без разделителя), оставляем одну копию.
 */
function dedupeRepeatedBody(text: string): string {
  const t = text.trim();
  if (t.length < 2) return t;

  const paras = t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 2 && normalizeWs(paras[0]) === normalizeWs(paras[1])) {
    return paras[0];
  }

  const nw = normalizeWs(t);
  if (nw.length >= 4 && nw.length % 2 === 0) {
    const half = nw.length / 2;
    const a = nw.slice(0, half);
    const b = nw.slice(half);
    if (a === b) {
      const cut = Math.floor(t.length / 2);
      const approx = t.slice(0, cut).trimEnd();
      return approx.length ? approx : a;
    }
  }

  return t;
}

/**
 * Текст поста: не склеивать вложенные `.tgme_widget_message_text` (даёт дубль в ленте виджета).
 */
function extractWidgetMessageText(
  $: cheerio.CheerioAPI,
  $message: cheerio.Cheerio<AnyNode>,
): string {
  const $blocks = $message.find(".tgme_widget_message_text");
  if ($blocks.length === 0) return "";

  const leaves: string[] = [];
  $blocks.each((_, node) => {
    const $n = $(node);
    if ($n.find(".tgme_widget_message_text").length > 0) return;
    const piece = $n.text().trim();
    if (piece) leaves.push(piece);
  });

  let raw: string;
  if (leaves.length === 1) {
    raw = leaves[0];
  } else if (leaves.length > 1) {
    const norms = leaves.map((s) => normalizeWs(s));
    const uniq = new Set(norms);
    if (uniq.size === 1) {
      raw = leaves[0];
    } else {
      raw = leaves.join("\n\n");
    }
  } else {
    const innermost = $blocks.filter(
      (_, n) => $(n).find(".tgme_widget_message_text").length === 0,
    );
    raw = innermost.length
      ? innermost.first().text().trim()
      : $blocks.first().text().trim();
  }

  return dedupeRepeatedBody(raw);
}

/** Экспорт для тестов и отладки парсера виджета. */
export function parseMessages(
  html: string,
  user: string,
  limit: number,
): TelegramPublicMessage[] {
  const $ = cheerio.load(html);
  const out: TelegramPublicMessage[] = [];

  $(".tgme_widget_message").each((_, el) => {
    if (out.length >= limit) return false;

    const $el = $(el);
    const dataPost = $el.attr("data-post");
    const dateA = $el.find(".tgme_widget_message_date").first();
    const href = dateA.attr("href")?.trim() ?? "";
    const timeEl = dateA.find("time");
    const datetime = timeEl.attr("datetime") ?? null;

    const text = extractWidgetMessageText($, $el);
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

  return out;
}

// ---------------------------------------------------------------------------
// Публичный API
// ---------------------------------------------------------------------------

export async function fetchPublicChannelMessages(
  channelUser: string,
  limit = 25,
  before?: string | null,
): Promise<TelegramPublicPage> {
  const user = channelUser.replace(/^@/, "").trim();
  if (!user) return { items: [], nextBefore: null };

  const { html, nextBefore } = await fetchChannelHtml(user, before ?? null);
  const items = parseMessages(html, user, limit);

  return { items, nextBefore };
}

export async function downloadTelegramImage(url: string): Promise<Buffer> {
  const attempts = 3;
  const timeoutMs = 20000;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) await pause(300 + i * 300);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await telegramFetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": pickUA(i),
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer: "https://t.me/",
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        if (shouldRetry(res.status) && i < attempts - 1) continue;
        throw new Error(`Не удалось скачать изображение: ${res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof Error && e.name === "AbortError" && i < attempts - 1) {
        continue;
      }
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("Таймаут при скачивании изображения.");
      }
      if (i >= attempts - 1) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    }
  }

  throw new Error("Не удалось скачать изображение.");
}
