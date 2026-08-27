import { querySiteSettingsRow } from "./site-settings-db";
import { resolveSiteOrigin } from "./site-origin";

const INDEXNOW_ENDPOINT = "https://yandex.com/indexnow";
const KEY_LOCATION_PATH = "/indexnow-key.txt";
const INDEXNOW_KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

type Fetcher = typeof fetch;

export function getIndexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";
  return INDEXNOW_KEY_PATTERN.test(key) ? key : null;
}

export function isIndexNowConfigured(): boolean {
  return getIndexNowKey() !== null;
}

export async function submitIndexNowUrls(
  siteOrigin: string,
  urls: string[],
  fetcher: Fetcher = fetch,
): Promise<{ submitted: number; status: number }> {
  const key = getIndexNowKey();
  if (!key) return { submitted: 0, status: 0 };
  const origin = resolveSiteOrigin(siteOrigin);
  const host = new URL(origin).host;
  const normalized = [
    ...new Set(
      urls.flatMap((value) => {
        try {
          const url = new URL(value, `${origin}/`);
          url.hash = "";
          return url.host === host && /^https?:$/.test(url.protocol)
            ? [url.toString()]
            : [];
        } catch {
          return [];
        }
      }),
    ),
  ].slice(0, 10_000);
  if (!normalized.length) return { submitted: 0, status: 0 };

  const response = await fetcher(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${origin}${KEY_LOCATION_PATH}`,
      urlList: normalized,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`IndexNow вернул HTTP ${response.status}`);
  }
  return { submitted: normalized.length, status: response.status };
}

/** Best effort: сбой поискового API никогда не должен ломать сохранение контента. */
export async function notifyIndexNowPaths(paths: string[]): Promise<void> {
  try {
    const settings = await querySiteSettingsRow();
    const origin = resolveSiteOrigin(settings.siteUrl);
    await submitIndexNowUrls(origin, paths);
  } catch {
    // Следующий sitemap crawl всё равно обнаружит изменение.
  }
}
