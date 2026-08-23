import { describe, expect, it } from "vitest";
import {
  imageUrlsForSitemap,
  MAX_SITEMAP_IMAGES_PER_PAGE,
  MAX_SITEMAP_URL_LENGTH,
  normalizeImageUrlForSitemap,
} from "./image-sitemap";

describe("imageUrlsForSitemap", () => {
  it("выбирает самый качественный вариант и делает локальный URL абсолютным", () => {
    expect(
      imageUrlsForSitemap("https://aliceinrussialand.ru/", [
        {
          variantsJson: JSON.stringify({
            w640: "/media/post/image/w640.webp",
            w960: "/media/post/image/w960.webp",
            w1280: "/media/post/image/w1280.webp",
          }),
        },
      ]),
    ).toEqual([
      "https://aliceinrussialand.ru/media/post/image/w1280.webp",
    ]);
  });

  it("поддерживает внешний CDN, fallback и пропускает битые записи", () => {
    expect(
      imageUrlsForSitemap("https://aliceinrussialand.ru", [
        { variantsJson: "not-json" },
        { variantsJson: JSON.stringify({ w1280: "" }) },
        {
          variantsJson: JSON.stringify({
            w960: "https://cdn.example.com/post/image/w960.webp",
          }),
        },
        {
          variantsJson: JSON.stringify({
            w640: "https://cdn.example.com/post/image/w960.webp",
          }),
        },
      ]),
    ).toEqual(["https://cdn.example.com/post/image/w960.webp"]);
  });

  it("соблюдает лимит поисковиков в 1000 изображений на страницу", () => {
    const images = Array.from(
      { length: MAX_SITEMAP_IMAGES_PER_PAGE + 1 },
      (_, index) => ({
        variantsJson: JSON.stringify({
          w1280: `/media/post/image-${index}/w1280.webp`,
        }),
      }),
    );

    expect(
      imageUrlsForSitemap("https://aliceinrussialand.ru", images),
    ).toHaveLength(MAX_SITEMAP_IMAGES_PER_PAGE);
  });

  it("сохраняет query CDN URL, разрешает protocol-relative URL и удаляет fragment", () => {
    expect(
      normalizeImageUrlForSitemap(
        "https://aliceinrussialand.ru",
        "https://cdn.example.com/image.webp?w=1280&fit=cover#preview",
      ),
    ).toBe("https://cdn.example.com/image.webp?w=1280&fit=cover");
    expect(
      normalizeImageUrlForSitemap(
        "https://aliceinrussialand.ru",
        "//cdn.example.com/image.webp",
      ),
    ).toBe("https://cdn.example.com/image.webp");
  });

  it.each([
    "ftp://cdn.example.com/image.webp",
    "javascript:alert(1)",
    "data:image/webp;base64,AAAA",
  ])("отбрасывает неподдерживаемую схему %s", (url) => {
    expect(
      normalizeImageUrlForSitemap("https://aliceinrussialand.ru", url),
    ).toBeNull();
  });

  it("отбрасывает URL длиннее лимита Sitemap", () => {
    const prefix = "https://cdn.example.com/";
    const url = `${prefix}${"a".repeat(MAX_SITEMAP_URL_LENGTH - prefix.length)}`;
    expect(
      normalizeImageUrlForSitemap("https://aliceinrussialand.ru", url),
    ).toBeNull();
  });

  it("использует младший вариант, если более качественный URL невалиден", () => {
    expect(
      imageUrlsForSitemap("https://aliceinrussialand.ru", [
        {
          variantsJson: JSON.stringify({
            w1280: "javascript:alert(1)",
            w960: "/media/post/image/w960.webp",
          }),
        },
      ]),
    ).toEqual([
      "https://aliceinrussialand.ru/media/post/image/w960.webp",
    ]);
  });
});
