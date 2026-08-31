import { describe, expect, it } from "vitest";
import {
  buildWebmasterSnapshot,
  canonicalUrlKey,
  webmasterDateMs,
  type SearchCandidate,
} from "./yandex-webmaster-monitor";
import type { YandexWebmasterData } from "./yandex-webmaster";

const origin = "https://aliceinrussialand.ru";

function candidate(
  path: string,
  updatedAt: string,
  kind: SearchCandidate["kind"] = "POST",
): SearchCandidate {
  return {
    url: `${origin}${path}`,
    label: path,
    kind,
    updatedAt: new Date(updatedAt),
  };
}

function data(overrides: Partial<YandexWebmasterData>): YandexWebmasterData {
  return {
    userId: 1,
    hostId: "host",
    hostUrl: `${origin}/`,
    downloaded: [],
    inSearch: [],
    events: [],
    recrawlTasks: [],
    quota: { daily_quota: 150, quota_remainder: 145 },
    ...overrides,
  };
}

describe("buildWebmasterSnapshot", () => {
  it("разбирает дату Яндекса с запятой, но не рекомендует уже найденную страницу", () => {
    const snapshot = buildWebmasterSnapshot({
      siteUrl: origin,
      indexNowConfigured: true,
      candidates: [candidate("/p/wolf", "2026-08-21T10:00:00.000Z")],
      data: data({
        inSearch: [
          {
            url: `${origin}/p/wolf`,
            last_access: "2026-08-20T10:00:00,000+0000",
          },
        ],
      }),
    });

    expect(webmasterDateMs("2026-08-20T10:00:00,000+0000")).toBe(
      Date.parse("2026-08-20T10:00:00.000Z"),
    );
    expect(snapshot.items[0]).toMatchObject({
      status: "IN_SEARCH",
      changedAfterCrawl: true,
      recommended: false,
      lastAccess: "2026-08-20T10:00:00.000Z",
    });
  });

  it("не рекомендует очередь, исключённые страницы и ошибки", () => {
    const candidates = [
      candidate("/p/queued", "2026-08-21T10:00:00Z"),
      candidate("/p/duplicate", "2026-08-21T10:00:00Z"),
      candidate("/p/not-found", "2026-08-21T10:00:00Z"),
      candidate("/p/unknown", "2026-08-21T10:00:00Z"),
    ];
    const snapshot = buildWebmasterSnapshot({
      siteUrl: origin,
      indexNowConfigured: false,
      candidates,
      data: data({
        recrawlTasks: [
          {
            task_id: "1",
            url: `${origin}/p/queued`,
            added_time: "2026-08-21T11:00:00Z",
            state: "IN_PROGRESS",
          },
        ],
        events: [
          {
            url: `${origin}/p/duplicate`,
            event_date: "2026-08-21T11:00:00Z",
            event: "REMOVED_FROM_SEARCH",
            excluded_url_status: "DUPLICATE",
          },
          {
            url: `${origin}/p/not-found`,
            event_date: "2026-08-21T11:00:00Z",
            event: "REMOVED_FROM_SEARCH",
            excluded_url_status: "NOTHING_FOUND",
          },
        ],
      }),
    });

    expect(snapshot.items.find((item) => item.url.endsWith("/queued"))).toMatchObject({
      status: "QUEUED",
      recommended: false,
    });
    expect(snapshot.items.find((item) => item.url.endsWith("/duplicate"))).toMatchObject({
      status: "EXCLUDED",
      recommended: false,
    });
    expect(snapshot.items.find((item) => item.url.endsWith("/not-found"))).toMatchObject({
      status: "EXCLUDED",
      recommended: false,
    });
    expect(snapshot.items.find((item) => item.url.endsWith("/unknown"))).toMatchObject({
      status: "UNKNOWN",
      recommended: true,
    });
  });
});

describe("canonicalUrlKey", () => {
  it("объединяет эквивалентные URL и отбрасывает fragment", () => {
    expect(canonicalUrlKey(`${origin}/p/wolf/?b=2&a=1#image`)).toBe(
      canonicalUrlKey(`${origin}/p/wolf?a=1&b=2`),
    );
  });
});
