import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { post: { findMany } },
}));

describe("GET /api/admin/posts", () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it("ищет по названию, slug и тексту публикации без учёта регистра", async () => {
    const { GET } = await import("./route");

    await GET(new Request("http://localhost/api/admin/posts?q=%D0%9A%D0%BE%D0%BB%D0%BE%D0%BC%D0%BD%D0%B0"));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { title: { contains: "Коломна", mode: "insensitive" } },
            { slug: { contains: "Коломна", mode: "insensitive" } },
            { body: { contains: "Коломна", mode: "insensitive" } },
          ],
        },
        take: 20,
        select: expect.objectContaining({
          _count: { select: { images: true } },
        }),
      }),
    );
  });

  it("не запускает широкий поиск по одному символу", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/posts?q=%D0%9A"));

    expect(findMany).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ items: [] });
  });
});
