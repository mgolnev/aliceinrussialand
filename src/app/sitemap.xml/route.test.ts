import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadIndex: vi.fn(),
  fallback: vi.fn(),
}));

vi.mock("@/lib/sitemap-data", () => ({
  loadSitemapIndexEntries: mocks.loadIndex,
  fallbackSitemapIndexEntries: mocks.fallback,
}));

import { GET } from "./route";

describe("GET /sitemap.xml", () => {
  beforeEach(() => {
    mocks.loadIndex.mockResolvedValue([
      { url: "https://example.com/sitemaps/pages.xml" },
    ]);
    mocks.fallback.mockReturnValue([
      { url: "https://example.com/sitemaps/fallback.xml" },
    ]);
  });

  it("отдаёт sitemap index", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(await response.text()).toContain("<sitemapindex");
  });

  it("при недоступной БД сохраняет контракт index и отдаёт fallback с кодом 200", async () => {
    mocks.loadIndex.mockRejectedValue(new Error("database unavailable"));
    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("https://example.com/sitemaps/fallback.xml");
  });
});
