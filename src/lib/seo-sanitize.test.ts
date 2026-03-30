import { describe, expect, it } from "vitest";
import { stripEmojiForSeo } from "./seo-sanitize";

describe("stripEmojiForSeo", () => {
  it("убирает эмодзи, сохраняет текст", () => {
    expect(stripEmojiForSeo("Привет 🤫 конец")).toBe("Привет конец");
  });
});
