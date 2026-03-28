import { describe, expect, it } from "vitest";
import {
  assertFeedPostJsonShape,
  FEED_POST_JSON_KEYS,
} from "./feed-contract";

describe("feed JSON contract", () => {
  it("валидный объект проходит", () => {
    const item = {
      id: "1",
      slug: "a",
      title: "t",
      body: "",
      displayMode: "GRID",
      publishedAt: null,
      pinned: false,
      categoryId: null,
      category: null,
      images: [],
    };
    expect(() => assertFeedPostJsonShape(item)).not.toThrow();
  });

  it("лишнее поле — ошибка", () => {
    const item = {
      id: "1",
      slug: "a",
      title: "t",
      body: "",
      displayMode: "GRID",
      publishedAt: null,
      pinned: false,
      categoryId: null,
      category: null,
      images: [],
      extra: 1,
    };
    expect(() => assertFeedPostJsonShape(item)).toThrow(/unexpected keys/);
  });

  it("список ключей зафиксирован", () => {
    expect([...FEED_POST_JSON_KEYS]).toEqual([
      "id",
      "slug",
      "title",
      "body",
      "displayMode",
      "publishedAt",
      "pinned",
      "categoryId",
      "category",
      "images",
    ]);
  });
});
