import { afterEach, describe, expect, it, vi } from "vitest";

const stat = vi.fn();
const readFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: { stat, readFile },
  stat,
  readFile,
}));

describe("GET /media/[...path]", () => {
  afterEach(() => {
    stat.mockReset();
    readFile.mockReset();
  });

  it("отдаёт WebP, записанный после запуска Next", async () => {
    stat.mockResolvedValue({ isFile: () => true });
    readFile.mockResolvedValue(Buffer.from("webp"));

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/media/post/image/w640.webp"), {
      params: Promise.resolve({ path: ["post", "image", "w640.webp"] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe("webp");
  });

  it("не позволяет выйти за пределы media и не читает не-WebP", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/media/../../.env"), {
      params: Promise.resolve({ path: ["..", "..", ".env"] }),
    });

    expect(res.status).toBe(404);
    expect(stat).not.toHaveBeenCalled();
  });
});
