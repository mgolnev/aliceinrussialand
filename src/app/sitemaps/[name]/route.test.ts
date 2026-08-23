import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pages: vi.fn(),
  posts: vi.fn(),
}));

vi.mock("@/lib/sitemap-data", () => ({
  POSTS_PER_IMAGE_SITEMAP: 4,
  fallbackSitemapEntries: () => [{ url: "https://example.com/" }],
  loadPagesSitemapEntries: mocks.pages,
  loadPostSitemapEntries: mocks.posts,
}));

import { GET } from "./route";

function context(name: string) {
  return { params: Promise.resolve({ name }) };
}

describe("GET /sitemaps/[name]", () => {
  beforeEach(() => {
    mocks.pages.mockResolvedValue([{ url: "https://example.com/about" }]);
    mocks.posts.mockResolvedValue([
      {
        url: "https://example.com/p/volk-duren",
        images: ["https://cdn.example.com/wolf.webp?a=1&b=2"],
      },
    ]);
  });

  it("отдаёт карту страниц", async () => {
    const response = await GET(new Request("https://example.com"), context("pages.xml"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("https://example.com/about");
  });

  it("передаёт индекс shard и экранирует URL картинки", async () => {
    const response = await GET(
      new Request(
        "https://example.com/sitemaps/posts.xml?ids=cuidBoundary%2CcuidNext",
      ),
      context("posts.xml"),
    );
    const xml = await response.text();

    expect(mocks.posts).toHaveBeenCalledWith(["cuidBoundary", "cuidNext"]);
    expect(xml).toContain("wolf.webp?a=1&amp;b=2");
  });

  it("возвращает 404 для неизвестного имени", async () => {
    const response = await GET(
      new Request("https://example.com"),
      context("posts.xml.bak"),
    );
    expect(response.status).toBe(404);
  });

  it("отдаёт автономную fallback-карту без загрузки БД", async () => {
    const response = await GET(
      new Request("https://example.com"),
      context("fallback.xml"),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<urlset");
    expect(mocks.pages).not.toHaveBeenCalled();
    expect(mocks.posts).not.toHaveBeenCalled();
  });

  it("возвращает валидный пустой XML и 503 при ошибке", async () => {
    mocks.pages.mockRejectedValue(new Error("database unavailable"));
    const response = await GET(new Request("https://example.com"), context("pages.xml"));
    const xml = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
  });
});
