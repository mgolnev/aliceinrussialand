import { describe, expect, it } from "vitest";
import { adminPostListPreview } from "./admin-post-list-preview";

describe("adminPostListPreview", () => {
  it("при непустом теле берёт начало текста, даже если title совпадает с первым предложением", () => {
    const body = "А тем временем поезда в метро ходят исправно. Второе.";
    const title = "А тем временем поезда в метро ходят исправно.";
    expect(adminPostListPreview(title, body)).toBe(
      "А тем временем поезда в метро ходят исправно.",
    );
  });

  it("без тела показывает заголовок", () => {
    expect(adminPostListPreview("Только заголовок", "")).toBe("Только заголовок");
  });

  it("пусто → Без текста", () => {
    expect(adminPostListPreview("", "")).toBe("Без текста");
  });
});
