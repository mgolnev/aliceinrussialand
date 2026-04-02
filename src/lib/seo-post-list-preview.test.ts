import { describe, expect, it } from "vitest";
import { getSeoPostListPreviewParts } from "./seo-post-list-preview";

describe("getSeoPostListPreviewParts", () => {
  it("uses first sentence of title and strips duplicate from body", () => {
    const title = "Стакан достойный порции кофеина.";
    const body =
      "Стакан достойный порции кофеина. Второе предложение про вкус и объём.";
    const { heading, excerpt } = getSeoPostListPreviewParts(title, body);
    expect(heading).toBe("Стакан достойный порции кофеина.");
    expect(excerpt).toContain("Второе предложение");
    expect(excerpt).not.toContain("Стакан достойный");
  });

  it("without title returns single excerpt from body", () => {
    const { heading, excerpt } = getSeoPostListPreviewParts(
      "",
      "Только текст поста без отдельного заголовка.",
    );
    expect(heading).toBeNull();
    expect(excerpt.length).toBeGreaterThan(0);
  });
});
