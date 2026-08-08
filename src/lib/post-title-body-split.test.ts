import { describe, expect, it } from "vitest";
import { stripLeadingTitleFromBody } from "./post-title-body-split";

describe("stripLeadingTitleFromBody", () => {
  it("removes a formatted title without leaving Markdown markers", () => {
    expect(stripLeadingTitleFromBody("**Важная новость.** Продолжение текста", "Важная новость.")).toBe("Продолжение текста");
  });
});
