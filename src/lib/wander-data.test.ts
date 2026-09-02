import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { post: { findMany } } }));
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));
import { getWanderCatalogue } from "./wander-data";

function project(id: string) {
  return { project: { id, slug: id, title: id } };
}

function post(
  id: string,
  variantsJson = '{"w1280":"/large.webp","w640":"/small.webp"}',
  projectIds: string[] = [],
) {
  return {
    id, slug: id, title: "Новая публикация",
    images: [{ id: `${id}-image-1`, variantsJson, alt: "Рисунок ручкой", width: 800, height: 1000 }],
    projects: projectIds.map(project),
  };
}

describe("публичный каталог прогулки", () => {
  beforeEach(() => { findMany.mockResolvedValue([]); });

  it("запрашивает все опубликованные публикации с изображениями", async () => {
    await getWanderCatalogue();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "PUBLISHED", images: { some: {} } },
      orderBy: { id: "asc" },
    }));
    const select = findMany.mock.calls[0][0].select;
    expect(select.body).toBeUndefined();
    expect(select.images.take).toBeUndefined();
    expect(select.images.orderBy).toEqual({ sortOrder: "asc" });
    expect(select.projects.where).toEqual({ project: { status: "PUBLISHED" } });
  });

  it("включает самостоятельную публикацию без подборок", async () => {
    findMany.mockResolvedValue([post("standalone")]);
    const catalogue = await getWanderCatalogue();
    expect(catalogue.posts).toEqual([expect.objectContaining({ id: "standalone", projectIds: [] })]);
    expect(catalogue.projects).toEqual([]);
  });

  it("не исключает опубликованную подборку с одной визуальной работой", async () => {
    findMany.mockResolvedValue([post("only", undefined, ["small-cycle"])]);
    const catalogue = await getWanderCatalogue();
    expect(catalogue.posts[0].projectIds).toEqual(["small-cycle"]);
    expect(catalogue.projects).toEqual([{ id: "small-cycle", slug: "small-cycle", title: "small-cycle", postIds: ["only"] }]);
  });

  it("собирает связи одной публикации с несколькими публичными подборками", async () => {
    findMany.mockResolvedValue([post("a", undefined, ["portrait", "pen"]), post("b", undefined, ["portrait"])]);
    const catalogue = await getWanderCatalogue();
    expect(catalogue.posts[0].projectIds).toEqual(["portrait", "pen"]);
    expect(catalogue.projects).toEqual([
      { id: "portrait", slug: "portrait", title: "portrait", postIds: ["a", "b"] },
      { id: "pen", slug: "pen", title: "pen", postIds: ["a"] },
    ]);
  });

  it("передаёт прогулке все изображения публикации в авторском порядке", async () => {
    const comic = post("comic", undefined, ["comic"]);
    comic.images.push({
      id: "comic-image-2",
      variantsJson: '{"w960":"/page-2.webp","w640":"/page-2-small.webp"}',
      alt: "Вторая страница",
      width: 1000,
      height: 800,
    });
    findMany.mockResolvedValue([comic]);
    const catalogue = await getWanderCatalogue();
    expect(catalogue.posts[0].images.map((image) => image.id)).toEqual(["comic-image-1", "comic-image-2"]);
    expect(catalogue.posts[0].images[1]).toMatchObject({ src: "/page-2.webp", thumbnail: "/page-2-small.webp" });
  });

  it("исключает сломанные варианты и небезопасные URL", async () => {
    findMany.mockResolvedValue([
      post("bad-json", "{"),
      post("bad-url", '{"w1280":"javascript:alert(1)"}'),
      post("array", "[]"),
    ]);
    expect(await getWanderCatalogue()).toEqual({ posts: [], projects: [] });
  });

  it("принимает безопасные абсолютные адреса изображений", async () => {
    findMany.mockResolvedValue([post("remote", '{"w960":"https://example.com/image.webp"}')]);
    const catalogue = await getWanderCatalogue();
    expect(catalogue.posts[0].images[0].src).toBe("https://example.com/image.webp");
  });
});
