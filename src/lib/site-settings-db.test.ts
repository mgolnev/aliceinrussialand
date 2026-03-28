import { describe, expect, it, vi, beforeEach } from "vitest";
import { defaultSiteSettings, querySiteSettingsRow } from "./site-settings-db";

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

describe("querySiteSettingsRow", () => {
  beforeEach(() => {
    findUnique.mockReset();
    delete process.env.NEXT_PHASE;
  });

  it("читает БД при каждом вызове (без React.cache)", async () => {
    findUnique.mockResolvedValue({
      ...defaultSiteSettings(),
      displayName: "Test",
    });
    await querySiteSettingsRow();
    await querySiteSettingsRow();
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("на сборке Next не ходит в БД", async () => {
    process.env.NEXT_PHASE = "phase-production-build";
    await querySiteSettingsRow();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
