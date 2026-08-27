import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /indexnow-key.txt", () => {
  it("публикует только настроенный ключ как UTF-8 text", async () => {
    vi.stubEnv("INDEXNOW_KEY", "valid-indexnow-key-123");
    const { GET } = await import("./route");
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("valid-indexnow-key-123\n");
  });

  it("не открывает endpoint без валидного ключа", async () => {
    vi.stubEnv("INDEXNOW_KEY", "short");
    const { GET } = await import("./route");
    expect(GET().status).toBe(404);
  });
});
