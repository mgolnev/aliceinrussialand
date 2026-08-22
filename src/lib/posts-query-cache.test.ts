import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUnique, findFirst } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    post: {
      findUnique,
      findFirst,
    },
  },
}));

describe("getPublishedPostBySlugCached", () => {
  beforeEach(() => {
    findUnique.mockReset();
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
    findUnique.mockResolvedValue(post);
    const { getPublishedPostBySlugCached } = await import("./posts-query");
    const a = await getPublishedPostBySlugCached("x");
    const b = await getPublishedPostBySlugCached("x");
    expect(a?.id).toBe(b?.id);
    expect(findUnique.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("обращается к oldSlugs только после промаха по текущему slug", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue({ id: "legacy", slug: "current", status: "PUBLISHED" });

    const { getPublishedPostBySlug } = await import("./posts-query");
    const post = await getPublishedPostBySlug("old");

    expect(post?.id).toBe("legacy");
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: "old" } }));
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED", oldSlugs: { has: "old" } },
      }),
    );
  });
});
