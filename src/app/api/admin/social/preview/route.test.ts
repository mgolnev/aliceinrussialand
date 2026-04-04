import { beforeEach, describe, expect, it, vi } from "vitest";

const preview = vi.fn();
const getSocialImportProvider = vi.fn();
const listAlreadyImportedSourceUrls = vi.fn();

vi.mock("@/lib/social-import/providers", () => ({
  getSocialImportProvider,
}));

vi.mock("@/lib/social-import/import-core", () => ({
  listAlreadyImportedSourceUrls,
}));

describe("POST /api/admin/social/preview", () => {
  beforeEach(() => {
    preview.mockResolvedValue({
      items: [
        {
          externalId: "1",
          href: "https://example.com/p/1",
          text: "caption",
          imageUrls: ["https://img/1.jpg"],
          dateIso: null,
        },
      ],
      nextCursor: "c2",
    });
    getSocialImportProvider.mockReturnValue({ preview });
    listAlreadyImportedSourceUrls.mockResolvedValue(["https://example.com/p/1"]);
  });

  it("валидация platform", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/admin/social/preview", {
        method: "POST",
        body: JSON.stringify({ platform: "x", account: "user" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("возвращает items + importedSourceUrls", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/admin/social/preview", {
        method: "POST",
        body: JSON.stringify({
          platform: "instagram",
          account: "alice",
          limit: 20,
          before: "c1",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      platform: string;
      account: string;
      items: Array<{ externalId: string }>;
      importedSourceUrls: string[];
    };
    expect(data.platform).toBe("instagram");
    expect(data.account).toBe("alice");
    expect(data.items[0]?.externalId).toBe("1");
    expect(data.importedSourceUrls).toEqual(["https://example.com/p/1"]);
    expect(getSocialImportProvider).toHaveBeenCalledWith("instagram");
    expect(listAlreadyImportedSourceUrls).toHaveBeenCalled();
  });
});
