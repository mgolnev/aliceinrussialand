import { describe, expect, it } from "vitest";
import { POST_IMAGE_MAX_BYTES } from "./upload-limits";

describe("upload-limits", () => {
  it("лимит пост-изображения 15 МБ", () => {
    expect(POST_IMAGE_MAX_BYTES).toBe(15 * 1024 * 1024);
  });
});
