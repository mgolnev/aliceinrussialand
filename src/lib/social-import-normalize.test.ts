import { describe, expect, it } from "vitest";
import {
  normalizeBehanceProjectUrl,
  normalizeInstagramPostUrl,
  normalizeSourceUrl,
} from "@/lib/social-import/normalize";

describe("social source URL normalize", () => {
  it("instagram: http -> https и хвостовой slash убирается", () => {
    expect(
      normalizeInstagramPostUrl("http://www.instagram.com/p/ABC123/"),
    ).toBe("https://www.instagram.com/p/ABC123");
  });

  it("behance: хвостовой slash убирается", () => {
    expect(
      normalizeBehanceProjectUrl("https://www.behance.net/gallery/12345/Test/"),
    ).toBe("https://www.behance.net/gallery/12345/Test");
  });

  it("normalizeSourceUrl делегирует по платформе", () => {
    expect(normalizeSourceUrl("instagram", "http://instagram.com/p/x/")).toBe(
      "https://instagram.com/p/x",
    );
    expect(normalizeSourceUrl("behance", "https://behance.net/x/")).toBe(
      "https://behance.net/x",
    );
  });
});
