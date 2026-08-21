import { describe, expect, it } from "vitest";
import { buildSeoDocumentTitle } from "./seo-document-title";

describe("buildSeoDocumentTitle", () => {
  it("оставляет имя автора в title ровно один раз", () => {
    expect(
      buildSeoDocumentTitle(
        "Впечатления от выставки — Алиса Гольнева · Алиса Гольнева",
        "Алиса Гольнева",
      ),
    ).toBe("Впечатления от выставки | Алиса Гольнева");
  });

  it("исправляет одиночную HTML-кавычку из старого title", () => {
    expect(
      buildSeoDocumentTitle("Наброски ручкой — Алиса Гольнева&quot;", "Алиса Гольнева"),
    ).toBe("Наброски ручкой | Алиса Гольнева");
  });
});
