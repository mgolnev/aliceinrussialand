import { describe, expect, it, vi, beforeEach } from "vitest";

const getPublishedPostMediaBySlug = vi.fn();

vi.mock("@/lib/posts-query", () => ({
  getPublishedPostMediaBySlug,
}));

describe("GET /api/posts/[slug]/media", () => {
  beforeEach(() => {
    getPublishedPostMediaBySlug.mockReset();
  });

  it("404 если пост не найден", async () => {
    getPublishedPostMediaBySlug.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/posts/x/media"), {
      params: Promise.resolve({ slug: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("отдаёт изображения с вариантами и Cache-Control", async () => {
    getPublishedPostMediaBySlug.mockResolvedValue({
      images: [
        {
          id: "i1",
          variants: { w640: "/a", w1280: "/b" },
        },
      ],
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/posts/s/media"), {
      params: Promise.resolve({ slug: "s" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { images: unknown[] };
    expect(body.images).toHaveLength(1);
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("public");
    expect(cc).toContain("s-maxage");
  });
});
