import { ProxyAgent, fetch as undiciFetch } from "undici";

let proxyDispatcher: ProxyAgent | undefined;

function outboundProxyUrl(): string | undefined {
  const v =
    process.env.TELEGRAM_OUTBOUND_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim();
  return v || undefined;
}

export function isTelegramProxyConfigured(): boolean {
  return Boolean(outboundProxyUrl());
}

function getDispatcher(): ProxyAgent | undefined {
  const url = outboundProxyUrl();
  if (!url) return undefined;
  if (!proxyDispatcher) {
    proxyDispatcher = new ProxyAgent(url);
  }
  return proxyDispatcher;
}

/**
 * Исходящий fetch к t.me / CDN Telegram. При необходимости идёт через
 * TELEGRAM_OUTBOUND_PROXY или стандартные HTTPS_PROXY / HTTP_PROXY.
 */
export async function telegramFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const dispatcher = getDispatcher();
  const res = await undiciFetch(
    url,
    {
      ...init,
      ...(dispatcher ? { dispatcher } : {}),
    } as Parameters<typeof undiciFetch>[1],
  );
  return res as unknown as Response;
}
