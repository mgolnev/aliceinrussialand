import { describe, expect, it } from "vitest";
import {
  assessPostSeoForReview,
  buildSeoTitleDuplicateCounts,
  publishedProjectNeedsSeoReview,
  SEO_REVIEW_PRIORITY,
} from "./seo-review";

describe("проверка SEO-полей перед AI-предложением", () => {
  it("считает «Новая публикация» критичным title", () => {
    expect(
      assessPostSeoForReview({
        metaTitle: "Новая публикация",
        metaDescription: "Комикс Волк-дурень в портфолио художницы Алисы Гольневой.",
        duplicateTitleCount: 6,
      }),
    ).toMatchObject({
      priority: SEO_REVIEW_PRIORITY.CRITICAL,
      duplicateTitleCount: 6,
    });
  });

  it("помечает короткий description как улучшение, но не как критичную ошибку", () => {
    expect(
      assessPostSeoForReview({
        metaTitle: "Керамическая скульптура рыбы — Алиса Гольнева",
        metaDescription: "Керамическая рыба.",
        duplicateTitleCount: 1,
      }),
    ).toMatchObject({ priority: SEO_REVIEW_PRIORITY.IMPROVE });
  });

  it("оставляет осмысленную уникальную пару вне очереди", () => {
    expect(
      assessPostSeoForReview({
        metaTitle: "Комикс «Волк-дурень» — Алиса Гольнева",
        metaDescription:
          "Комикс «Волк-дурень» — авторская иллюстрация Алисы Гольневой: страницы истории и детали работы.",
        duplicateTitleCount: 1,
      }).priority,
    ).toBeNull();
  });

  it("нормализует title перед поиском дубликатов", () => {
    const counts = buildSeoTitleDuplicateCounts([
      "  План-минимум на август ",
      "план-минимум   на август",
    ]);
    expect(counts.get("план-минимум на август")).toBe(2);
  });

  it("берёт в работу только опубликованную подборку без SEO-поля", () => {
    expect(
      publishedProjectNeedsSeoReview({
        status: "PUBLISHED",
        metaTitle: "",
        metaDescription: "Описание цикла работ",
      }),
    ).toBe(true);
    expect(
      publishedProjectNeedsSeoReview({
        status: "DRAFT",
        metaTitle: "",
        metaDescription: "",
      }),
    ).toBe(false);
  });
});
