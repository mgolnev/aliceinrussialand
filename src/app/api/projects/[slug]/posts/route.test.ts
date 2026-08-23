import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublishedProjectBySlugCached = vi.fn();
const getPublishedProjectPostsPageCached = vi.fn();
const projectPostToFeedPost = vi.fn();

vi.mock("@/lib/projects", () => ({
  getPublishedProjectBySlugCached,
  getPublishedProjectPostsPageCached,
  projectPostToFeedPost,
}));

describe("GET /api/projects/[slug]/posts", () => {
  beforeEach(() => {
    getPublishedProjectBySlugCached.mockReset();
    getPublishedProjectPostsPageCached.mockReset();
    projectPostToFeedPost.mockReset();
    getPublishedProjectBySlugCached.mockResolvedValue({
      id: "project-1",
      slug: "ritual-keramika",
      orderMode: "MANUAL",
    });
    getPublishedProjectPostsPageCached.mockResolvedValue({
      items: [{ id: "post-9" }],
      total: 17,
      page: 2,
      pageSize: 8,
    });
    projectPostToFeedPost.mockReturnValue({ id: "post-9", images: [] });
  });

  it("отдаёт следующую порцию и ссылку на следующий постоянный page URL", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/projects/ritual-keramika/posts?page=2"),
      { params: Promise.resolve({ slug: "ritual-keramika" }) },
    );

    expect(getPublishedProjectBySlugCached).toHaveBeenCalledWith("ritual-keramika");
    expect(getPublishedProjectPostsPageCached).toHaveBeenCalledWith(
      "project-1",
      "MANUAL",
      2,
    );
    expect(await res.json()).toEqual({
      items: [{ id: "post-9", images: [] }],
      nextPage: 3,
    });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("не открывает несуществующую страницу", async () => {
    getPublishedProjectPostsPageCached.mockResolvedValue({
      items: [],
      total: 17,
      page: 99,
      pageSize: 8,
    });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/projects/ritual-keramika/posts?page=99"),
      { params: Promise.resolve({ slug: "ritual-keramika" }) },
    );

    expect(res.status).toBe(404);
  });
});
