import { afterEach, describe, expect, it, vi } from "vitest";
import {
  YandexWebmasterApiError,
  YandexWebmasterClient,
} from "./yandex-webmaster";

afterEach(() => {
  vi.unstubAllEnvs();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("YandexWebmasterClient", () => {
  it("находит подтверждённый сайт и собирает данные из документированных ресурсов", async () => {
    vi.stubEnv("YANDEX_WEBMASTER_TOKEN", "server-only-token");
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/v4/user")) return json({ user_id: 42 });
      if (url.endsWith("/v4/user/42/hosts")) {
        return json({
          hosts: [
            {
              host_id: "https:aliceinrussialand.ru:443",
              ascii_host_url: "https://aliceinrussialand.ru/",
              verified: true,
            },
          ],
        });
      }
      if (url.includes("/indexing/samples")) {
        return json({
          count: 1,
          samples: [
            {
              url: "https://aliceinrussialand.ru/p/wolf",
              status: "HTTP_2XX",
              http_code: 200,
              access_date: "2026-08-20T10:00:00,000+0300",
            },
          ],
        });
      }
      if (url.includes("/search-urls/in-search/samples")) {
        return json({ count: 0, samples: [] });
      }
      if (url.includes("/search-urls/events/samples")) {
        return json({ count: 0, samples: [] });
      }
      if (url.includes("/recrawl/queue")) return json({ tasks: [] });
      if (url.includes("/recrawl/quota")) {
        return json({ daily_quota: 150, quota_remainder: 149 });
      }
      return json({ error_message: "unexpected URL" }, 500);
    });

    const client = await YandexWebmasterClient.connect(
      "https://aliceinrussialand.ru",
      fetcher as typeof fetch,
    );
    const data = await client.getData();

    expect(data.hostUrl).toBe("https://aliceinrussialand.ru/");
    expect(data.downloaded).toHaveLength(1);
    expect(data.quota).toEqual({ daily_quota: 150, quota_remainder: 149 });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("https%3Aaliceinrussialand.ru%3A443/indexing/samples"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "OAuth server-only-token",
        }),
      }),
    );
  });

  it("не подключается без серверного токена", async () => {
    vi.stubEnv("YANDEX_WEBMASTER_TOKEN", "");
    await expect(
      YandexWebmasterClient.connect("https://aliceinrussialand.ru"),
    ).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
      status: 503,
    } satisfies Partial<YandexWebmasterApiError>);
  });
});
