import { beforeEach, describe, expect, it, vi } from "vitest";

const listSearchCandidates = vi.fn();
const connect = vi.fn();

vi.mock("@/lib/yandex-webmaster-monitor", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/yandex-webmaster-monitor")
  >();
  return { ...actual, listSearchCandidates };
});

vi.mock("@/lib/indexnow", () => ({
  isIndexNowConfigured: () => true,
}));

vi.mock("@/lib/yandex-webmaster", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/yandex-webmaster")>();
  return {
    ...actual,
    isYandexWebmasterConfigured: () => true,
    YandexWebmasterClient: { connect },
  };
});

const siteUrl = "https://aliceinrussialand.ru";

describe("POST /api/admin/webmaster", () => {
  beforeEach(() => {
    listSearchCandidates.mockResolvedValue({
      siteUrl,
      items: [
        {
          url: `${siteUrl}/p/wolf`,
          label: "Волк",
          kind: "POST",
          updatedAt: new Date("2026-08-20T00:00:00Z"),
        },
        {
          url: `${siteUrl}/p/fox`,
          label: "Лиса",
          kind: "POST",
          updatedAt: new Date("2026-08-20T00:00:00Z"),
        },
      ],
    });
  });

  it("не принимает внешний или неопубликованный URL", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/webmaster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: ["https://example.com/p/wolf"] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it("не теряет остаток квоты на URL, который уже был в очереди", async () => {
    const { YandexWebmasterApiError } = await import("@/lib/yandex-webmaster");
    const submitRecrawl = vi
      .fn()
      .mockRejectedValueOnce(
        new YandexWebmasterApiError(
          "Уже добавлен",
          409,
          "URL_ALREADY_ADDED",
        ),
      )
      .mockResolvedValueOnce({ taskId: "task-2", quotaRemainder: 0 });
    connect.mockResolvedValue({
      getQuota: vi.fn().mockResolvedValue({
        daily_quota: 150,
        quota_remainder: 1,
      }),
      submitRecrawl,
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/webmaster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [`${siteUrl}/p/wolf`, `${siteUrl}/p/fox`],
        }),
      }),
    );
    const body = (await response.json()) as {
      accepted: string[];
      alreadyQueued: string[];
    };

    expect(response.status).toBe(200);
    expect(submitRecrawl).toHaveBeenCalledTimes(2);
    expect(body.alreadyQueued).toEqual([`${siteUrl}/p/wolf`]);
    expect(body.accepted).toEqual([`${siteUrl}/p/fox`]);
  });
});
