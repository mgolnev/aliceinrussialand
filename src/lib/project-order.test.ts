import { describe, expect, it } from "vitest";
import {
  comparePostsNewestFirst,
  projectOrderMode,
  PROJECT_ORDER_MODE,
} from "./project-order";

describe("порядок публикаций в подборке", () => {
  it("по умолчанию распознаёт режим «сначала новые»", () => {
    expect(projectOrderMode(undefined)).toBe(PROJECT_ORDER_MODE.NEWEST_FIRST);
    expect(projectOrderMode("MANUAL")).toBe(PROJECT_ORDER_MODE.MANUAL);
  });

  it("ставит новые публикации выше независимо от порядка добавления", () => {
    const posts = [
      { id: "march", publishedAt: "2026-03-20T12:00:00.000Z" },
      { id: "august", publishedAt: "2026-08-01T12:00:00.000Z" },
      { id: "january", publishedAt: "2026-01-05T12:00:00.000Z" },
    ];

    expect([...posts].sort(comparePostsNewestFirst).map((post) => post.id)).toEqual([
      "august",
      "march",
      "january",
    ]);
  });

  it("не даёт публикациям без даты обойти опубликованные", () => {
    const posts = [
      { id: "draft", publishedAt: null },
      { id: "published", publishedAt: "2026-08-01T12:00:00.000Z" },
    ];

    expect([...posts].sort(comparePostsNewestFirst).map((post) => post.id)).toEqual([
      "published",
      "draft",
    ]);
  });
});
