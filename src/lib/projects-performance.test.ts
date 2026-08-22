import { beforeEach, describe, expect, it, vi } from "vitest";

const { projectFindFirst, postProjectFindMany, postProjectCount } = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  postProjectFindMany: vi.fn(),
  postProjectCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: projectFindFirst },
    postProject: {
      findMany: postProjectFindMany,
      count: postProjectCount,
    },
  },
}));

describe("публичные запросы подборок", () => {
  beforeEach(() => {
    projectFindFirst.mockReset();
    postProjectFindMany.mockReset();
    postProjectCount.mockReset();
  });

  it("читает summary проекта без body и изображений", async () => {
    projectFindFirst.mockResolvedValue({
      id: "project",
      slug: "series",
      title: "Серия",
      description: "",
      metaTitle: "",
      metaDescription: "",
      orderMode: "NEWEST_FIRST",
      updatedAt: new Date(),
      posts: [{ id: "one" }, { id: "two" }],
    });
    const { getPublishedProjectBySlug } = await import("./projects");

    await getPublishedProjectBySlug("series");

    const args = projectFindFirst.mock.calls[0]?.[0];
    expect(args.select.posts).toEqual(
      expect.objectContaining({ take: 2, select: { id: true } }),
    );
    expect(JSON.stringify(args.select)).not.toContain("body");
    expect(JSON.stringify(args.select)).not.toContain("images");
  });

  it("ограничивает страницу проекта восемью постами", async () => {
    postProjectCount.mockResolvedValue(18);
    postProjectFindMany.mockResolvedValue([]);
    const { getPublishedProjectPostsPage } = await import("./projects");

    const page = await getPublishedProjectPostsPage("project", "NEWEST_FIRST", 2);

    expect(postProjectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 8, take: 8 }),
    );
    expect(page).toEqual(expect.objectContaining({ total: 18, page: 2, pageSize: 8 }));
  });
});
