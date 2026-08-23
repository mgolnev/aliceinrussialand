import { describe, expect, it } from "vitest";
import {
  MAX_SITEMAP_ENTRIES,
  serializeSitemapIndex,
  serializeUrlSet,
} from "./sitemap-xml";

function expectValidXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  expect(document.querySelector("parsererror")).toBeNull();
  return document;
}

describe("sitemap XML", () => {
  it("экранирует URL страниц и картинок с query-параметрами", () => {
    const xml = serializeUrlSet([
      {
        url: "https://example.com/archive?page=2&tag=волк",
        images: ["https://cdn.example.com/wolf.webp?w=1280&fit=cover"],
        lastModified: new Date("2026-08-23T10:00:00.000Z"),
      },
    ]);

    const document = expectValidXml(xml);
    expect(xml).toContain("archive?page=2&amp;tag=волк");
    expect(xml).toContain("wolf.webp?w=1280&amp;fit=cover");
    expect(document.querySelector("loc")?.textContent).toBe(
      "https://example.com/archive?page=2&tag=волк",
    );
    expect(xml).toContain(
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    );
  });

  it("создаёт валидный индекс Sitemap", () => {
    const xml = serializeSitemapIndex([
      { url: "https://example.com/sitemaps/posts-0.xml?part=1&full=true" },
    ]);

    expectValidXml(xml);
    expect(xml).toContain("part=1&amp;full=true");
  });

  it("не сериализует невалидные и слишком длинные loc", () => {
    const tooLong = `https://example.com/${"a".repeat(2048)}`;
    const xml = serializeUrlSet([
      { url: "javascript:alert(1)" },
      { url: tooLong },
      { url: "https://example.com/ok" },
    ]);

    expectValidXml(xml);
    expect(xml).not.toContain("javascript:");
    expect(xml).not.toContain(tooLong);
    expect(xml).toContain("https://example.com/ok");
  });

  it("не позволяет превысить 50 000 записей", () => {
    const entries = Array.from({ length: MAX_SITEMAP_ENTRIES + 1 }, (_, i) => ({
      url: `https://example.com/sitemaps/${i}.xml`,
    }));

    expect(() => serializeSitemapIndex(entries)).toThrow(/50,000/);
  });
});
