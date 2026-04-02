import { describe, expect, it, vi, beforeEach } from "vitest";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const getFeedPage = vi.fn();

vi.mock("@/lib/feed-server", () => ({
  getFeedPage,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "alice_session",
  verifySessionToken: vi.fn(),
}));

describe("GET /api/feed", () => {
  beforeEach(() => {
    getFeedPage.mockResolvedValue({
      items: [],
      nextCursor: null,
      categories: [],
    });
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(verifySessionToken).mockResolvedValue(false);
  });

  it("Cache-Control без публичного CDN-кэша (актуальная лента после правок)", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/feed"));
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("no-store");
    expect(cc).toContain("private");
  });

  it("с cursor: тот же политика кэша", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/feed?cursor=abc"),
    );
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("без сессии: getFeedPage с профилем public", async () => {
    getFeedPage.mockClear();
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/feed"));
    expect(getFeedPage).toHaveBeenCalledWith(undefined, undefined, "public");
  });

  it("с cursor и category: пробрасывает аргументы и public", async () => {
    getFeedPage.mockClear();
    const { GET } = await import("./route");
    await GET(
      new Request(
        "http://localhost/api/feed?cursor=c1&category=keramika",
      ),
    );
    expect(getFeedPage).toHaveBeenCalledWith("c1", "keramika", "public");
  });

  it("при валидной admin-сессии: профиль admin", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === SESSION_COOKIE_NAME ? { value: "tok" } : undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(verifySessionToken).mockResolvedValue(true);
    getFeedPage.mockClear();
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/feed"));
    expect(getFeedPage).toHaveBeenCalledWith(undefined, undefined, "admin");
  });
});
