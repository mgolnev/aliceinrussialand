import { describe, expect, it, vi, beforeEach } from "vitest";

const getFeedPage = vi.fn();

vi.mock("@/lib/feed-server", () => ({
  getFeedPage,
}));

describe("GET /api/feed", () => {
  beforeEach(() => {
    getFeedPage.mockResolvedValue({
      items: [],
      nextCursor: null,
      categories: [],
    });
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
});
