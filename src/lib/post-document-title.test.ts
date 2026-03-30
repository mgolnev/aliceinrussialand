import { describe, expect, it } from "vitest";
import { buildImplicitPostDocumentTitle } from "./post-document-title";

describe("buildImplicitPostDocumentTitle", () => {
  it("добавляет сайт в конце", () => {
    expect(
      buildImplicitPostDocumentTitle("Стакан супер.", "Алиса", "Живопись"),
    ).toBe("Стакан супер. · Живопись | Алиса");
  });

  it("без рубрики — только пост и сайт", () => {
    expect(buildImplicitPostDocumentTitle("Только пост", "Сайт", null)).toBe(
      "Только пост | Сайт",
    );
  });

  it("не дублирует сайт, если уже в заголовке", () => {
    expect(
      buildImplicitPostDocumentTitle("Выставка Алиса", "Алиса", "Новости"),
    ).toBe("Выставка Алиса · Новости");
  });

  it("не дублирует рубрику в заголовке", () => {
    expect(
      buildImplicitPostDocumentTitle("Живопись: этюд", "Сайт", "Живопись"),
    ).toBe("Живопись: этюд | Сайт");
  });
});
