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

  it("первая страница: Cache-Control с s-maxage=60", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/feed"));
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    expect(res.headers.get("cache-control")).toContain("stale-while-revalidate=300");
  });

  it("с cursor: более длинный s-maxage", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/feed?cursor=abc"),
    );
    expect(res.headers.get("cache-control")).toContain("s-maxage=120");
  });
});
