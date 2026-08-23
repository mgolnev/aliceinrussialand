import { describe, expect, it, vi } from "vitest";
import { touchPostAfterImageChange } from "./post-image-change";

describe("touchPostAfterImageChange", () => {
  it("обновляет lastmod родительского поста", async () => {
    const update = vi.fn().mockResolvedValue({ id: "post-1" });
    const updatedAt = new Date("2026-08-23T12:00:00.000Z");

    await touchPostAfterImageChange(
      { post: { update } } as never,
      "post-1",
      updatedAt,
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: { updatedAt },
      select: { id: true },
    });
  });
});
