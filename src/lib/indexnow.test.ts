import { afterEach, describe, expect, it, vi } from "vitest";
import { submitIndexNowUrls } from "./indexnow";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("submitIndexNowUrls", () => {
  it("отправляет только URL своего хоста, без fragment и дублей", async () => {
    vi.stubEnv("INDEXNOW_KEY", "valid-indexnow-key-123");
    const fetcher = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        {
          void _input;
          void _init;
          return new Response(null, { status: 202 });
        },
    );

    const result = await submitIndexNowUrls(
      "https://aliceinrussialand.ru",
      [
        "/p/wolf#photo",
        "https://aliceinrussialand.ru/p/wolf",
        "https://example.com/not-ours",
      ],
      fetcher as typeof fetch,
    );

    expect(result).toEqual({ submitted: 1, status: 202 });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init).toBeDefined();
    if (!init) throw new Error("IndexNow request init is missing");
    expect(JSON.parse(String(init.body))).toEqual({
      host: "aliceinrussialand.ru",
      key: "valid-indexnow-key-123",
      keyLocation: "https://aliceinrussialand.ru/indexnow-key.txt",
      urlList: ["https://aliceinrussialand.ru/p/wolf"],
    });
  });

  it("ничего не отправляет с невалидным ключом", async () => {
    vi.stubEnv("INDEXNOW_KEY", "short");
    const fetcher = vi.fn();
    await expect(
      submitIndexNowUrls("https://aliceinrussialand.ru", ["/p/wolf"], fetcher),
    ).resolves.toEqual({ submitted: 0, status: 0 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
