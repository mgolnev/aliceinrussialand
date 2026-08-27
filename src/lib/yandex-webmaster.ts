const WEBMASTER_API_ORIGIN = "https://api.webmaster.yandex.net";
const API_PAGE_SIZE = 100;
const API_MAX_URLS = 50_000;

export type YandexDownloadedPage = {
  url: string;
  status: string;
  http_code?: number;
  access_date: string;
};

export type YandexSearchPage = {
  url: string;
  title?: string;
  last_access: string;
};

export type YandexSearchEvent = {
  url: string;
  title?: string;
  event_date: string;
  last_access?: string;
  event: string;
  excluded_url_status?: string;
  bad_http_status?: number;
  target_url?: string;
};

export type YandexRecrawlTask = {
  task_id: string;
  url: string;
  added_time: string;
  state: string;
};

export type YandexRecrawlQuota = {
  daily_quota: number;
  quota_remainder: number;
};

export type YandexWebmasterData = {
  userId: number;
  hostId: string;
  hostUrl: string;
  downloaded: YandexDownloadedPage[];
  inSearch: YandexSearchPage[];
  events: YandexSearchEvent[];
  recrawlTasks: YandexRecrawlTask[];
  quota: YandexRecrawlQuota;
};

type Fetcher = typeof fetch;

export class YandexWebmasterApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "YandexWebmasterApiError";
  }
}

export function isYandexWebmasterConfigured(): boolean {
  return Boolean(process.env.YANDEX_WEBMASTER_TOKEN?.trim());
}

function normalizedOrigin(value: string): string {
  const url = new URL(value);
  return `${url.protocol}//${url.host}`;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export class YandexWebmasterClient {
  private constructor(
    private readonly token: string,
    readonly userId: number,
    readonly hostId: string,
    readonly hostUrl: string,
    private readonly fetcher: Fetcher,
  ) {}

  static async connect(
    siteOrigin: string,
    fetcher: Fetcher = fetch,
  ): Promise<YandexWebmasterClient> {
    const token = process.env.YANDEX_WEBMASTER_TOKEN?.trim();
    if (!token) {
      throw new YandexWebmasterApiError(
        "Не задан YANDEX_WEBMASTER_TOKEN",
        503,
        "NOT_CONFIGURED",
      );
    }

    const request = async (path: string) => {
      const response = await fetcher(`${WEBMASTER_API_ORIGIN}${path}`, {
        headers: { Authorization: `OAuth ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const data = parseJsonObject(await response.json().catch(() => null));
      if (!response.ok) {
        throw new YandexWebmasterApiError(
          typeof data.error_message === "string"
            ? data.error_message
            : `Яндекс Вебмастер вернул HTTP ${response.status}`,
          response.status,
          typeof data.error_code === "string" ? data.error_code : null,
        );
      }
      return data;
    };

    const user = await request("/v4/user");
    const userId = Number(user.user_id);
    if (!Number.isSafeInteger(userId)) {
      throw new YandexWebmasterApiError(
        "Яндекс не вернул корректный user_id",
        502,
        "INVALID_RESPONSE",
      );
    }
    const hostList = await request(`/v4/user/${userId}/hosts`);
    const hosts = Array.isArray(hostList.hosts) ? hostList.hosts : [];
    const targetOrigin = normalizedOrigin(siteOrigin);
    const host = hosts
      .map(parseJsonObject)
      .find((candidate) => {
        if (candidate.verified !== true) return false;
        const asciiUrl =
          typeof candidate.ascii_host_url === "string"
            ? candidate.ascii_host_url
            : "";
        try {
          return normalizedOrigin(asciiUrl) === targetOrigin;
        } catch {
          return false;
        }
      });
    if (!host || typeof host.host_id !== "string") {
      throw new YandexWebmasterApiError(
        `В аккаунте Яндекс Вебмастера не найден подтверждённый сайт ${targetOrigin}`,
        404,
        "HOST_NOT_FOUND",
      );
    }

    return new YandexWebmasterClient(
      token,
      userId,
      host.host_id,
      typeof host.ascii_host_url === "string"
        ? host.ascii_host_url
        : `${targetOrigin}/`,
      fetcher,
    );
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    const response = await this.fetcher(`${WEBMASTER_API_ORIGIN}${path}`, {
      ...init,
      headers: {
        Authorization: `OAuth ${this.token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = parseJsonObject(await response.json().catch(() => null));
    if (!response.ok) {
      throw new YandexWebmasterApiError(
        typeof data.error_message === "string"
          ? data.error_message
          : `Яндекс Вебмастер вернул HTTP ${response.status}`,
        response.status,
        typeof data.error_code === "string" ? data.error_code : null,
      );
    }
    return data;
  }

  private hostPath(suffix: string): string {
    return `/v4/user/${this.userId}/hosts/${encodeURIComponent(this.hostId)}${suffix}`;
  }

  private async pagedSamples<T>(suffix: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; offset < API_MAX_URLS; offset += API_PAGE_SIZE) {
      const separator = suffix.includes("?") ? "&" : "?";
      const data = await this.request(
        this.hostPath(
          `${suffix}${separator}offset=${offset}&limit=${API_PAGE_SIZE}`,
        ),
      );
      const samples = Array.isArray(data.samples) ? (data.samples as T[]) : [];
      rows.push(...samples);
      const total = Number(data.count);
      if (!samples.length || samples.length < API_PAGE_SIZE) break;
      if (Number.isFinite(total) && rows.length >= total) break;
    }
    return rows.slice(0, API_MAX_URLS);
  }

  private async recrawlTasks(dateFrom: string): Promise<YandexRecrawlTask[]> {
    const rows: YandexRecrawlTask[] = [];
    for (let offset = 0; offset < API_MAX_URLS; offset += API_PAGE_SIZE) {
      const data = await this.request(
        this.hostPath(
          `/recrawl/queue?offset=${offset}&limit=${API_PAGE_SIZE}&date_from=${encodeURIComponent(dateFrom)}`,
        ),
      );
      const tasks = Array.isArray(data.tasks)
        ? (data.tasks as YandexRecrawlTask[])
        : [];
      rows.push(...tasks);
      if (tasks.length < API_PAGE_SIZE) break;
    }
    return rows.slice(0, API_MAX_URLS);
  }

  async getData(): Promise<YandexWebmasterData> {
    const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [downloaded, inSearch, events, recrawlTasks, quotaData] =
      await Promise.all([
        this.pagedSamples<YandexDownloadedPage>("/indexing/samples"),
        this.pagedSamples<YandexSearchPage>(
          "/search-urls/in-search/samples",
        ),
        this.pagedSamples<YandexSearchEvent>("/search-urls/events/samples"),
        this.recrawlTasks(dateFrom),
        this.request(this.hostPath("/recrawl/quota")),
      ]);

    return {
      userId: this.userId,
      hostId: this.hostId,
      hostUrl: this.hostUrl,
      downloaded,
      inSearch,
      events,
      recrawlTasks,
      quota: {
        daily_quota: Number(quotaData.daily_quota) || 0,
        quota_remainder: Number(quotaData.quota_remainder) || 0,
      },
    };
  }

  async getQuota(): Promise<YandexRecrawlQuota> {
    const data = await this.request(this.hostPath("/recrawl/quota"));
    return {
      daily_quota: Number(data.daily_quota) || 0,
      quota_remainder: Number(data.quota_remainder) || 0,
    };
  }

  async submitRecrawl(url: string): Promise<{
    taskId: string;
    quotaRemainder: number;
  }> {
    const data = await this.request(this.hostPath("/recrawl/queue"), {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    return {
      taskId: typeof data.task_id === "string" ? data.task_id : "",
      quotaRemainder: Number(data.quota_remainder) || 0,
    };
  }
}
