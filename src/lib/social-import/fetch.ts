const DEFAULT_TIMEOUT_MS = 12000;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type FetchTextOpts = {
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export async function socialFetchText(
  url: string,
  opts: FetchTextOpts = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/json,*/*",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        ...opts.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function socialFetchJson<T>(
  url: string,
  opts: FetchTextOpts = {},
): Promise<T> {
  const txt = await socialFetchText(url, opts);
  return JSON.parse(txt) as T;
}

export async function downloadSocialImage(url: string): Promise<Buffer> {
  const attempts = 3;
  const timeoutMs = 20000;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: "https://www.instagram.com/",
        },
      });
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && i < attempts - 1) continue;
        throw new Error(`Не удалось скачать изображение: ${res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Не удалось скачать изображение.");
}
