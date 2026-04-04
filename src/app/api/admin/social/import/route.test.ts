import { beforeEach, describe, expect, it, vi } from "vitest";

const importSocialItems = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/social-import/import-core", () => ({
  importSocialItems,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

describe("POST /api/admin/social/import", () => {
  beforeEach(() => {
    importSocialItems.mockResolvedValue({ createdIds: ["p1", "p2"] });
  });

  it("валидация platform", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/admin/social/import", {
        method: "POST",
        body: JSON.stringify({ platform: "x", items: [] }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("импортирует выбранные элементы", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/admin/social/import", {
        method: "POST",
        body: JSON.stringify({
          platform: "behance",
          publish: true,
          items: [
            {
              externalId: "x1",
              href: "https://behance.net/gallery/1/a",
              text: "text",
              imageUrls: ["https://img/1.jpg"],
              dateIso: null,
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { createdIds: string[] };
    expect(data.createdIds).toEqual(["p1", "p2"]);
    expect(importSocialItems).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "behance",
        publish: true,
      }),
    );
  });
});
