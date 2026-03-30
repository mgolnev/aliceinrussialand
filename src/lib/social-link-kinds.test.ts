import { describe, expect, it } from "vitest";
import { inferSocialKindFromUrl } from "./social-link-kinds";
import { parseSocialLinks } from "./site";

describe("inferSocialKindFromUrl", () => {
  it("определяет популярные домены", () => {
    expect(inferSocialKindFromUrl("https://www.youtube.com/@user")).toBe(
      "youtube",
    );
    expect(inferSocialKindFromUrl("https://youtu.be/abc")).toBe("youtube");
    expect(inferSocialKindFromUrl("https://pinterest.com/x")).toBe(
      "pinterest",
    );
    expect(inferSocialKindFromUrl("https://t.me/channel")).toBe("telegram");
    expect(inferSocialKindFromUrl("mailto:a@b.co")).toBe("email");
  });
});

describe("parseSocialLinks", () => {
  it("подставляет kind по URL, если в JSON невалидный тип", () => {
    const json = JSON.stringify([
      {
        id: "1",
        label: "",
        url: "https://youtube.com/c/artist",
        kind: "unknown-platform",
      },
    ]);
    const links = parseSocialLinks(json);
    expect(links[0]?.kind).toBe("youtube");
  });

  it("для «Другое» подставляет тип по URL", () => {
    const json = JSON.stringify([
      {
        id: "1",
        label: "",
        url: "https://www.pinterest.ru/name/",
        kind: "other",
      },
    ]);
    expect(parseSocialLinks(json)[0]?.kind).toBe("pinterest");
  });
});
