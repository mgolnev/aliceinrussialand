import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureSiteSettings: vi.fn(),
  getSiteSettings: vi.fn(),
  update: vi.fn(),
  notifyIndexNowPaths: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/lib/site", () => ({
  ensureSiteSettings: mocks.ensureSiteSettings,
  getSiteSettings: mocks.getSiteSettings,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { siteSettings: { update: mocks.update } },
}));
vi.mock("@/lib/indexnow", () => ({
  notifyIndexNowPaths: mocks.notifyIndexNowPaths,
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: mocks.after };
});

describe("PATCH /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureSiteSettings.mockResolvedValue({ id: 1 });
    mocks.update.mockResolvedValue({ id: 1, showWanderEntry: false });
  });

  it("сохраняет видимость входа «не выбирай» как boolean", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showWanderEntry: false }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { showWanderEntry: false },
    });
  });

  it("не принимает строку вместо checkbox-значения", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showWanderEntry: "false" }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
