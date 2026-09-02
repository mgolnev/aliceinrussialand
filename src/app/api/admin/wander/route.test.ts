import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureSiteSettings: vi.fn(),
  categoryFindMany: vi.fn(),
  categoryUpdateMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  invalidateWanderCatalogueCache: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/site", () => ({ ensureSiteSettings: mocks.ensureSiteSettings }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    postCategory: {
      findMany: mocks.categoryFindMany,
      updateMany: mocks.categoryUpdateMany,
    },
    siteSettings: { update: mocks.update },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/cache-tags", () => ({
  invalidateWanderCatalogueCache: mocks.invalidateWanderCatalogueCache,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

describe("PATCH /api/admin/wander", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureSiteSettings.mockResolvedValue({ id: 1 });
    mocks.categoryFindMany.mockResolvedValue([{ id: "seen" }]);
    mocks.categoryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.update.mockResolvedValue({
      showWanderEntry: false,
      wanderEntryLabel: "не трогай",
      wanderEntrySubtitle: "посмотрим, что будет",
    });
    mocks.transaction.mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations));
  });

  it("сохраняет только существующие исключения и сбрасывает каталог", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/admin/wander", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showWanderEntry: false,
        entryLabel: "  не трогай  ",
        entrySubtitle: "  посмотрим, что будет  ",
        excludedCategoryIds: ["seen", "deleted-category"],
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        showWanderEntry: false,
        wanderEntryLabel: "не трогай",
        wanderEntrySubtitle: "посмотрим, что будет",
      },
      select: { showWanderEntry: true, wanderEntryLabel: true, wanderEntrySubtitle: true },
    });
    expect(mocks.categoryUpdateMany).toHaveBeenNthCalledWith(1, {
      data: { includeInWander: true },
    });
    expect(mocks.categoryUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["seen"] } },
      data: { includeInWander: false },
    });
    expect(mocks.invalidateWanderCatalogueCache).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/wander");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    await expect(response.json()).resolves.toEqual({
      showWanderEntry: false,
      entryLabel: "не трогай",
      entrySubtitle: "посмотрим, что будет",
      excludedCategoryIds: ["seen"],
    });
  });

  it("отклоняет повреждённый список", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/admin/wander", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showWanderEntry: true,
        entryLabel: "не нажимай сюда",
        excludedCategoryIds: "seen",
      }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([" ", "x".repeat(161), null, 42, {}])("отклоняет некорректную подпись %j", async (entrySubtitle) => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/admin/wander", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showWanderEntry: true, entryLabel: "не жми сюда", entrySubtitle, excludedCategoryIds: [] }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.ensureSiteSettings).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("сохраняет подпись при запросе из старой версии формы", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/admin/wander", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showWanderEntry: true, entryLabel: "не жми сюда", excludedCategoryIds: [] }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("wanderEntrySubtitle");
    expect((await response.json()).entrySubtitle).toBe("посмотрим, что будет");
  });

  it("отклоняет пустую надпись", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/admin/wander", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showWanderEntry: true,
        entryLabel: "   ",
        excludedCategoryIds: [],
      }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
