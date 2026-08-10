import { ProxyAgent, fetch as undiciFetch } from "undici";

let explicitProxyDispatcher: ProxyAgent | undefined;
let ambientProxyDispatcher: ProxyAgent | undefined;

function explicitProxyUrl(): string | undefined {
  return process.env.TELEGRAM_OUTBOUND_PROXY?.trim() || undefined;
}

function ambientProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY?.trim() || process.env.HTTP_PROXY?.trim() || undefined
  );
}

export function isTelegramProxyConfigured(): boolean {
  return Boolean(explicitProxyUrl() || ambientProxyUrl());
}

function getDispatcher(kind: "explicit" | "ambient"): ProxyAgent | undefined {
  const url = kind === "explicit" ? explicitProxyUrl() : ambientProxyUrl();
  if (!url) return undefined;

  if (kind === "explicit") {
    explicitProxyDispatcher ??= new ProxyAgent(url);
    return explicitProxyDispatcher;
  }

  ambientProxyDispatcher ??= new ProxyAgent(url);
  return ambientProxyDispatcher;
}

function fetchWithDispatcher(
  url: string,
  init: RequestInit | undefined,
  dispatcher?: ProxyAgent,
): Promise<Response> {
  return undiciFetch(
    url,
    {
      ...init,
      ...(dispatcher ? { dispatcher } : {}),
    } as Parameters<typeof undiciFetch>[1],
  ) as unknown as Promise<Response>;
}

function isLikelyBlocked(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}

/**
 * Исходящий fetch к t.me / CDN Telegram. При необходимости идёт через
 * TELEGRAM_OUTBOUND_PROXY или стандартные HTTPS_PROXY / HTTP_PROXY.
 */
export async function telegramFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  // Явный прокси — осознанная настройка пользователя, используем его сразу.
  const explicit = getDispatcher("explicit");
  if (explicit) return fetchWithDispatcher(url, init, explicit);

  // HTTP(S)_PROXY может быть технической переменной окружения хостинга и не
  // подходить для Telegram. Пробуем прямой запрос прежде, чем задействовать его.
  let directError: unknown;
  try {
    const direct = await fetchWithDispatcher(url, init);
    if (!isLikelyBlocked(direct.status) || !getDispatcher("ambient")) {
      return direct;
    }
  } catch (error) {
    directError = error;
  }

  const ambient = getDispatcher("ambient");
  if (!ambient) throw directError;

  try {
    return await fetchWithDispatcher(url, init, ambient);
  } catch (proxyError) {
    throw directError ?? proxyError;
  }
}
