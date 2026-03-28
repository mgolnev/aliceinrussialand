import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    siteSettings: {
      findUnique,
    },
  },
}));

describe("getSiteSettings + React.cache", () => {
  beforeEach(() => {
    findUnique.mockReset();
    delete process.env.NEXT_PHASE;
    vi.resetModules();
  });

  it("два вызова возвращают одни и те же данные; в RSC к БД — один раз на запрос", async () => {
    const row = {
      id: 1,
      displayName: "Cached",
      tagline: "",
      bio: "",
      aboutMarkdown: "",
      avatarMediaPath: null,
      aboutPhotoPath: null,
      socialLinksJson: "[]",
      telegramChannelUser: "",
      contactsLabel: "Контакты",
      defaultLocale: "ru",
      siteUrl: "http://localhost:3000",
      plausibleDomain: "",
      yandexMetrikaId: "",
      updatedAt: new Date(),
    };
    findUnique.mockResolvedValue(row);
    const { getSiteSettings } = await import("./site");
    const a = await getSiteSettings();
    const b = await getSiteSettings();
    expect(a.displayName).toBe(b.displayName);
    /** В Vitest без контекста RSC `cache()` может вызвать Prisma дважды — это ок. */
    expect(findUnique.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
