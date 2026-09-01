import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { project: { findMany } } }));
import { getWanderCatalogue } from "./wander-data";

function post(id: string, variantsJson = '{"w1280":"/large.webp","w640":"/small.webp"}') {
  return { post: { id, slug: id, title: "Новая публикация", images: [{ id: `${id}-image-1`, variantsJson, alt: "Рисунок ручкой", width: 800, height: 1000 }] } };
}
function project(id: string, posts = [post("a"), post("b")], count = 2) {
  return { id, slug: id, title: id, _count: { posts: count }, posts };
}

describe("публичный каталог прогулки", () => {
  beforeEach(() => { findMany.mockResolvedValue([]); });
  it("ограничивает запрос опубликованными подборками и публикациями", async () => {
    await getWanderCatalogue();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "PUBLISHED" },
      select: expect.objectContaining({
        _count: { select: { posts: { where: { post: { status: "PUBLISHED" } } } } },
        posts: expect.objectContaining({ where: { post: { status: "PUBLISHED", images: { some: {} } } } }),
      }),
    }));
    const select = findMany.mock.calls[0][0].select.posts.select.post.select;
    expect(select.body).toBeUndefined();
    expect(select.images.take).toBeUndefined();
    expect(select.images.orderBy).toEqual({ sortOrder: "asc" });
  });
  it("не раскрывает подборки с одной опубликованной работой", async () => {
    findMany.mockResolvedValue([project("private-cycle", [post("a")], 1)]);
    expect(await getWanderCatalogue()).toEqual({ posts: [], projects: [] });
  });
  it("объединяет повторные работы и сохраняет связи между подборками", async () => {
    findMany.mockResolvedValue([project("portrait"), project("pen")]);
    const catalogue = await getWanderCatalogue();
    expect(catalogue.posts).toHaveLength(2);
    expect(catalogue.posts[0].projectIds).toEqual(["portrait", "pen"]);
    expect(catalogue.posts[0].title).toBe("Рисунок ручкой");
    expect(catalogue.posts[0].images).toEqual([expect.objectContaining({ id: "a-image-1", src: "/large.webp", thumbnail: "/small.webp" })]);
  });
  it("передаёт прогулке все изображения публикации в авторском порядке", async () => {
    const comic = post("comic");
    comic.post.images.push({
      id: "comic-image-2",
      variantsJson: '{"w960":"/page-2.webp","w640":"/page-2-small.webp"}',
      alt: "Вторая страница",
      width: 1000,
      height: 800,
    });
    findMany.mockResolvedValue([project("comic", [comic, post("other")])]);
    const catalogue = await getWanderCatalogue();
    expect(catalogue.posts[0].images.map((image) => image.id)).toEqual(["comic-image-1", "comic-image-2"]);
    expect(catalogue.posts[0].images[1]).toMatchObject({ src: "/page-2.webp", thumbnail: "/page-2-small.webp" });
  });
  it("исключает сломанные варианты и небезопасные URL", async () => {
    findMany.mockResolvedValue([project("pen", [post("bad-json", "{"), post("bad-url", '{"w1280":"javascript:alert(1)"}'), post("array", "[]")])]);
    expect(await getWanderCatalogue()).toEqual({ posts: [], projects: [] });
  });
  it("оставляет доступную подборку с одной иллюстрацией и текстовыми постами", async () => {
    findMany.mockResolvedValue([project("pen", [post("a", '{"w960":"https://example.com/image.webp"}')], 3)]);
    const catalogue = await getWanderCatalogue();
    expect(catalogue.posts).toHaveLength(1);
    expect(catalogue.projects[0].postIds).toEqual(["a"]);
  });
});
