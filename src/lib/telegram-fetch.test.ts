import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const proxyAgentMock = vi.fn();

vi.mock("undici", () => ({
  fetch: fetchMock,
  ProxyAgent: proxyAgentMock,
}));

describe("telegramFetch", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    proxyAgentMock.mockReset();
    proxyAgentMock.mockImplementation(() => ({ proxy: true }));
    delete process.env.TELEGRAM_OUTBOUND_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
  });

  it("сначала идёт напрямую, если хостинг задал только HTTPS_PROXY", async () => {
    process.env.HTTPS_PROXY = "http://ambient-proxy:8080";
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));

    const { telegramFetch } = await import("./telegram-fetch");
    const res = await telegramFetch("https://t.me/s/channel");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.dispatcher).toBeUndefined();
  });

  it("использует явный TELEGRAM_OUTBOUND_PROXY без прямой попытки", async () => {
    process.env.TELEGRAM_OUTBOUND_PROXY = "http://telegram-proxy:8080";
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));

    const { telegramFetch } = await import("./telegram-fetch");
    await telegramFetch("https://t.me/s/channel");

    expect(proxyAgentMock).toHaveBeenCalledWith("http://telegram-proxy:8080");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.dispatcher).toBeDefined();
  });

  it("после блокировки прямого запроса использует системный прокси", async () => {
    process.env.HTTPS_PROXY = "http://ambient-proxy:8080";
    fetchMock
      .mockResolvedValueOnce(new Response("blocked", { status: 403 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const { telegramFetch } = await import("./telegram-fetch");
    const res = await telegramFetch("https://t.me/s/channel");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.dispatcher).toBeDefined();
  });
});
