import { describe, expect, it, vi, beforeEach } from "vitest";

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    post: {
      findFirst,
    },
  },
}));

describe("getPublishedPostBySlugCached", () => {
  beforeEach(() => {
    findFirst.mockReset();
    vi.resetModules();
  });

  it("два вызова с тем же slug дают один и тот же пост", async () => {
    const post = {
      id: "1",
      slug: "x",
      title: "T",
      body: "",
      displayMode: "GRID",
      status: "PUBLISHED",
      publishedAt: new Date(),
      pinned: false,
      metaTitle: "",
      metaDescription: "",
      telegramSourceUrl: null,
      locale: "ru",
      categoryId: null,
      category: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      images: [],
    };
    findFirst.mockResolvedValue(post);
    const { getPublishedPostBySlugCached } = await import("./posts-query");
    const a = await getPublishedPostBySlugCached("x");
    const b = await getPublishedPostBySlugCached("x");
    expect(a?.id).toBe(b?.id);
    expect(findFirst.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
