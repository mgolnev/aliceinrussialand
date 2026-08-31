import { absoluteUrl } from "./absolute-url";
import { POST_STATUS } from "./constants";
import { prisma } from "./prisma";
import { PROJECT_STATUS } from "./projects";
import { SEO_PAGE_SIZE, listSeoCategories } from "./seo-content";
import { querySiteSettingsRow } from "./site-settings-db";
import { resolveSiteOrigin } from "./site-origin";
import type {
  YandexDownloadedPage,
  YandexRecrawlTask,
  YandexSearchEvent,
  YandexSearchPage,
  YandexWebmasterData,
} from "./yandex-webmaster";

export type SearchCandidateKind =
  | "POST"
  | "CORE"
  | "CATEGORY"
  | "PROJECT"
  | "ARCHIVE";

export type SearchCandidate = {
  url: string;
  label: string;
  kind: SearchCandidateKind;
  updatedAt: Date;
};

export type WebmasterUrlStatus =
  | "IN_SEARCH"
  | "QUEUED"
  | "EXCLUDED"
  | "CRAWLED"
  | "ERROR"
  | "UNKNOWN";

export type WebmasterUrlItem = {
  url: string;
  label: string;
  kind: SearchCandidateKind;
  status: WebmasterUrlStatus;
  statusDetail: string;
  updatedAt: string;
  lastAccess: string | null;
  httpCode: number | null;
  targetUrl: string | null;
  changedAfterCrawl: boolean;
  recommended: boolean;
  priority: number;
};

export type WebmasterSnapshot = {
  configured: boolean;
  indexNowConfigured: boolean;
  siteUrl: string;
  hostUrl: string | null;
  generatedAt: string;
  quota: { daily: number; remainder: number } | null;
  counts: {
    total: number;
    posts: number;
    inSearch: number;
    queued: number;
    excluded: number;
    crawled: number;
    error: number;
    unknown: number;
    recommended: number;
  };
  items: WebmasterUrlItem[];
};

export async function listSearchCandidates(): Promise<{
  siteUrl: string;
  items: SearchCandidate[];
}> {
  const settings = await querySiteSettingsRow();
  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const [posts, categories, projects, postCount, latestPost] = await Promise.all([
    prisma.post.findMany({
      where: { status: POST_STATUS.PUBLISHED },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        slug: true,
        title: true,
        updatedAt: true,
        publishedAt: true,
      },
    }),
    listSeoCategories([settings.tagline, settings.bio].filter(Boolean).join(" ")),
    prisma.project.findMany({
      where: {
        status: PROJECT_STATUS.PUBLISHED,
        posts: { some: { post: { status: POST_STATUS.PUBLISHED } } },
      },
      select: {
        slug: true,
        title: true,
        updatedAt: true,
        posts: {
          where: { post: { status: POST_STATUS.PUBLISHED } },
          take: 2,
          select: { id: true },
        },
      },
    }),
    prisma.post.count({ where: { status: POST_STATUS.PUBLISHED } }),
    prisma.post.aggregate({
      where: { status: POST_STATUS.PUBLISHED },
      _max: { updatedAt: true, publishedAt: true },
    }),
  ]);
  const contentUpdatedAt =
    latestPost._max.updatedAt ?? latestPost._max.publishedAt ?? settings.updatedAt;
  const archivePages = Math.ceil(postCount / SEO_PAGE_SIZE);

  return {
    siteUrl,
    items: [
      {
        url: absoluteUrl(siteUrl, "/"),
        label: "Главная",
        kind: "CORE",
        updatedAt: contentUpdatedAt,
      },
      {
        url: absoluteUrl(siteUrl, "/about"),
        label: "Обо мне",
        kind: "CORE",
        updatedAt: settings.updatedAt,
      },
      {
        url: absoluteUrl(siteUrl, "/archive"),
        label: "Архив",
        kind: "ARCHIVE",
        updatedAt: contentUpdatedAt,
      },
      ...Array.from({ length: Math.max(0, archivePages - 1) }, (_, index) => ({
        url: absoluteUrl(siteUrl, `/archive?page=${index + 2}`),
        label: `Архив — страница ${index + 2}`,
        kind: "ARCHIVE" as const,
        updatedAt: contentUpdatedAt,
      })),
      ...categories.map((category) => ({
        url: absoluteUrl(siteUrl, `/category/${category.slug}`),
        label: `Категория: ${category.name}`,
        kind: "CATEGORY" as const,
        updatedAt: category.updatedAt,
      })),
      ...projects
        .filter((project) => project.posts.length >= 2)
        .map((project) => ({
          url: absoluteUrl(siteUrl, `/projects/${project.slug}`),
          label: `Подборка: ${project.title}`,
          kind: "PROJECT" as const,
          updatedAt: project.updatedAt,
        })),
      ...posts.map((post) => ({
        url: absoluteUrl(siteUrl, `/p/${post.slug}`),
        label: post.title,
        kind: "POST" as const,
        updatedAt: post.updatedAt ?? post.publishedAt ?? settings.updatedAt,
      })),
    ],
  };
}

export function canonicalUrlKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

/** API Вебмастера иногда возвращает ISO-подобную дату с запятой перед миллисекундами. */
export function webmasterDateMs(value: string | null | undefined): number {
  if (!value) return 0;
  return Date.parse(value.replace(/,(\d{3})(?=[+-]\d{4}$|Z$)/, ".$1")) || 0;
}

function normalizedWebmasterDate(value: string | null | undefined): string | null {
  const time = webmasterDateMs(value);
  return time ? new Date(time).toISOString() : null;
}

function newestByUrl<T>(
  rows: T[],
  urlOf: (row: T) => string,
  dateOf: (row: T) => string | null | undefined,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const key = canonicalUrlKey(urlOf(row));
    if (!key) continue;
    const current = result.get(key);
    const nextDate = webmasterDateMs(dateOf(row));
    const currentDate = current ? webmasterDateMs(dateOf(current)) : -1;
    if (!current || nextDate >= currentDate) result.set(key, row);
  }
  return result;
}

function exclusionLabel(event: YandexSearchEvent): string {
  const labels: Record<string, string> = {
    NOTHING_FOUND: "Яндекс пока не знает страницу",
    NOT_CANONICAL: "Выбран другой канонический URL",
    ROBOTS_URL_ERROR: "Запрещено в robots.txt",
    HTTP_ERROR: `Ошибка HTTP${event.bad_http_status ? ` ${event.bad_http_status}` : ""}`,
    HOST_ERROR: "Робот не смог подключиться к сайту",
    DUPLICATE: "Страница признана дублем",
    LOW_QUALITY: "Недостаточно ценного содержимого",
  };
  return event.excluded_url_status
    ? labels[event.excluded_url_status] ?? event.excluded_url_status
    : "Исключена из поиска";
}

function activeRecrawl(task: YandexRecrawlTask | undefined): boolean {
  return Boolean(task && task.state !== "DONE" && task.state !== "FAILED");
}

function recommendation(args: {
  candidate: SearchCandidate;
  status: WebmasterUrlStatus;
}): { recommended: boolean; priority: number } {
  const { candidate, status } = args;
  // «Рекомендуемые» — только страницы, которых ещё нет в поиске. Обновлённые
  // страницы из выдачи автор при необходимости выбирает вручную во «Все»;
  // IndexNow уже сообщает Яндексу об их изменении.
  if (
    status === "IN_SEARCH" ||
    status === "QUEUED" ||
    status === "EXCLUDED" ||
    status === "ERROR"
  ) {
    return { recommended: false, priority: 0 };
  }
  if (candidate.kind === "POST") {
    return { recommended: true, priority: status === "UNKNOWN" ? 95 : 80 };
  }
  if (
    candidate.kind === "CORE" ||
    candidate.kind === "CATEGORY" ||
    candidate.kind === "PROJECT"
  ) {
    return { recommended: true, priority: status === "UNKNOWN" ? 75 : 60 };
  }
  return { recommended: false, priority: 0 };
}

export function buildWebmasterSnapshot(args: {
  candidates: SearchCandidate[];
  data: YandexWebmasterData;
  siteUrl: string;
  indexNowConfigured: boolean;
}): WebmasterSnapshot {
  const downloaded = newestByUrl<YandexDownloadedPage>(
    args.data.downloaded,
    (row) => row.url,
    (row) => row.access_date,
  );
  const inSearch = newestByUrl<YandexSearchPage>(
    args.data.inSearch,
    (row) => row.url,
    (row) => row.last_access,
  );
  const events = newestByUrl<YandexSearchEvent>(
    args.data.events,
    (row) => row.url,
    (row) => row.event_date,
  );
  const tasks = newestByUrl<YandexRecrawlTask>(
    args.data.recrawlTasks,
    (row) => row.url,
    (row) => row.added_time,
  );

  const items = args.candidates.map<WebmasterUrlItem>((candidate) => {
    const key = canonicalUrlKey(candidate.url) ?? candidate.url;
    const crawled = downloaded.get(key);
    const searchable = inSearch.get(key);
    const event = events.get(key);
    const task = tasks.get(key);
    const rawLastAccess =
      searchable?.last_access ?? crawled?.access_date ?? event?.last_access ?? null;
    const lastAccess = normalizedWebmasterDate(rawLastAccess);
    const changedAfterCrawl = Boolean(
      lastAccess && candidate.updatedAt.getTime() > webmasterDateMs(lastAccess) + 60_000,
    );

    let status: WebmasterUrlStatus;
    let statusDetail: string;
    if (activeRecrawl(task)) {
      status = "QUEUED";
      statusDetail = "Поставлена на переобход";
    } else if (searchable) {
      status = "IN_SEARCH";
      statusDetail = changedAfterCrawl
        ? "В поиске, но после обхода изменена"
        : "Участвует в поиске";
    } else if (event?.event === "REMOVED_FROM_SEARCH") {
      status = "EXCLUDED";
      statusDetail = exclusionLabel(event);
    } else if (crawled && crawled.status !== "HTTP_2XX") {
      status = "ERROR";
      statusDetail = `Робот получил ${crawled.http_code ?? crawled.status}`;
    } else if (crawled) {
      status = "CRAWLED";
      statusDetail = "Обойдена, но пока не в поиске";
    } else {
      status = "UNKNOWN";
      statusDetail = "Не найдена среди известных Яндексу страниц";
    }
    const suggested = recommendation({
      candidate,
      status,
    });

    return {
      url: candidate.url,
      label: candidate.label,
      kind: candidate.kind,
      status,
      statusDetail,
      updatedAt: candidate.updatedAt.toISOString(),
      lastAccess,
      httpCode: crawled?.http_code ?? event?.bad_http_status ?? null,
      targetUrl: event?.target_url ?? null,
      changedAfterCrawl,
      ...suggested,
    };
  });

  items.sort(
    (a, b) =>
      Number(b.recommended) - Number(a.recommended) ||
      b.priority - a.priority ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  const count = (status: WebmasterUrlStatus) =>
    items.filter((item) => item.status === status).length;

  return {
    configured: true,
    indexNowConfigured: args.indexNowConfigured,
    siteUrl: args.siteUrl,
    hostUrl: args.data.hostUrl,
    generatedAt: new Date().toISOString(),
    quota: {
      daily: args.data.quota.daily_quota,
      remainder: args.data.quota.quota_remainder,
    },
    counts: {
      total: items.length,
      posts: items.filter((item) => item.kind === "POST").length,
      inSearch: count("IN_SEARCH"),
      queued: count("QUEUED"),
      excluded: count("EXCLUDED"),
      crawled: count("CRAWLED"),
      error: count("ERROR"),
      unknown: count("UNKNOWN"),
      recommended: items.filter((item) => item.recommended).length,
    },
    items,
  };
}

export function disconnectedWebmasterSnapshot(args: {
  siteUrl: string;
  candidates: SearchCandidate[];
  indexNowConfigured: boolean;
}): WebmasterSnapshot {
  return {
    configured: false,
    indexNowConfigured: args.indexNowConfigured,
    siteUrl: args.siteUrl,
    hostUrl: null,
    generatedAt: new Date().toISOString(),
    quota: null,
    counts: {
      total: args.candidates.length,
      posts: args.candidates.filter((item) => item.kind === "POST").length,
      inSearch: 0,
      queued: 0,
      excluded: 0,
      crawled: 0,
      error: 0,
      unknown: args.candidates.length,
      recommended: 0,
    },
    items: [],
  };
}
