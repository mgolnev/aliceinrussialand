import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  postCount: vi.fn(),
  postFindMany: vi.fn(),
  postAggregate: vi.fn(),
  projectFindMany: vi.fn(),
  categories: vi.fn(),
}));

vi.mock("./site-settings-db", () => ({
  querySiteSettingsRow: mocks.settings,
}));
vi.mock("./prisma", () => ({
  prisma: {
    post: {
      count: mocks.postCount,
      findMany: mocks.postFindMany,
      aggregate: mocks.postAggregate,
    },
    project: { findMany: mocks.projectFindMany },
  },
}));
vi.mock("./seo-content", () => ({
  SEO_PAGE_SIZE: 24,
  listSeoCategories: mocks.categories,
}));
vi.mock("./projects", () => ({
  PROJECT_STATUS: { PUBLISHED: "PUBLISHED" },
}));
vi.mock("./site", () => ({
  parseAboutPhotoUrl: (value: string | null) => value,
  parseAvatarUrl: (value: string | null) => value,
}));

import {
  loadPagesSitemapEntries,
  loadPostSitemapEntries,
  loadSitemapIndexEntries,
  POSTS_PER_IMAGE_SITEMAP,
} from "./sitemap-data";

describe("sitemap data", () => {
  beforeEach(() => {
    const updatedAt = new Date("2026-08-23T10:00:00.000Z");
    mocks.settings.mockResolvedValue({
      siteUrl: "https://aliceinrussialand.ru",
      tagline: "Иллюстрации",
      bio: "Авторские проекты",
      updatedAt,
      aboutPhotoPath: "/media/about/w1280.webp",
      avatarMediaPath: null,
    });
    mocks.postCount.mockResolvedValue(0);
    mocks.postFindMany.mockResolvedValue([]);
    mocks.postAggregate.mockResolvedValue({
      _max: { updatedAt: null, publishedAt: null },
    });
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.categories.mockResolvedValue([]);
  });

  it("разбивает посты на ограниченные карты изображений", async () => {
    mocks.postFindMany.mockResolvedValue(
      Array.from({ length: POSTS_PER_IMAGE_SITEMAP * 2 + 1 }, (_, index) => ({
        id: `post-${index}`,
      })),
    );

    expect(await loadSitemapIndexEntries()).toEqual([
      { url: "https://aliceinrussialand.ru/sitemaps/pages.xml" },
      {
        url: "https://aliceinrussialand.ru/sitemaps/posts.xml?ids=post-0%2Cpost-1%2Cpost-2%2Cpost-3",
      },
      {
        url: "https://aliceinrussialand.ru/sitemaps/posts.xml?ids=post-4%2Cpost-5%2Cpost-6%2Cpost-7",
      },
      {
        url: "https://aliceinrussialand.ru/sitemaps/posts.xml?ids=post-8",
      },
    ]);
  });

  it("читает только нужный shard опубликованных постов", async () => {
    const updatedAt = new Date("2026-08-23T11:00:00.000Z");
    mocks.postFindMany.mockResolvedValue([
      {
        slug: "volk-duren",
        updatedAt,
        publishedAt: updatedAt,
        images: [
          {
            variantsJson: JSON.stringify({
              w1280: "https://cdn.example.com/wolf.webp?w=1280&fit=cover",
            }),
          },
        ],
      },
    ]);

    expect(
      await loadPostSitemapEntries(["post-boundary", "post-next"]),
    ).toEqual([
      {
        url: "https://aliceinrussialand.ru/p/volk-duren",
        lastModified: updatedAt,
        images: [
          "https://cdn.example.com/wolf.webp?w=1280&fit=cover",
        ],
      },
    ]);
    expect(mocks.postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PUBLISHED",
          id: { in: ["post-boundary", "post-next"] },
        },
        orderBy: { id: "asc" },
      }),
    );
  });

  it("ограничивает выборку проектов и добавляет фото страницы about", async () => {
    const entries = await loadPagesSitemapEntries();

    expect(entries).toContainEqual(
      expect.objectContaining({
        url: "https://aliceinrussialand.ru/about",
        images: ["https://aliceinrussialand.ru/media/about/w1280.webp"],
      }),
    );
    expect(mocks.projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          posts: expect.objectContaining({ take: 2 }),
        }),
      }),
    );
  });
});
