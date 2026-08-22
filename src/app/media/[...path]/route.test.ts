import { afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const stat = vi.fn();
const createReadStream = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: { stat },
  stat,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: { ...actual, createReadStream },
    createReadStream,
  };
});

describe("GET /media/[...path]", () => {
  afterEach(() => {
    stat.mockReset();
    createReadStream.mockReset();
  });

  it("отдаёт WebP, записанный после запуска Next", async () => {
    stat.mockResolvedValue({ isFile: () => true, size: 4 });
    createReadStream.mockReturnValue(Readable.from([Buffer.from("webp")]));

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/media/post/image/w640.webp"), {
      params: Promise.resolve({ path: ["post", "image", "w640.webp"] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("content-length")).toBe("4");
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
