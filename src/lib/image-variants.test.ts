import { describe, expect, it } from "vitest";
import {
  intrinsicSizeForImage,
  pickDefaultVariantUrl,
  pickVariantUrlForRequestedWidth,
  pickVariantUrlForWidth,
} from "./image-variants";

describe("image-variants", () => {
  it("pickDefaultVariantUrl предпочитает w960", () => {
    expect(
      pickDefaultVariantUrl({
        w640: "/a",
        w960: "/b",
        w1280: "/c",
      }),
    ).toBe("/b");
  });

  it("pickVariantUrlForWidth — узкий экран → w640", () => {
    expect(
      pickVariantUrlForWidth({ w640: "/a", w960: "/b", w1280: "/c" }, 400),
    ).toBe("/a");
  });

  it("intrinsicSizeForImage подставляет fallback", () => {
    expect(intrinsicSizeForImage(null, null)).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it("intrinsicSizeForImage сохраняет переданные размеры", () => {
    expect(intrinsicSizeForImage(800, 600)).toEqual({ width: 800, height: 600 });
  });

  describe("pickVariantUrlForRequestedWidth (loader next/image)", () => {
    const v = {
      w640: "/640.webp",
      w960: "/960.webp",
      w1280: "/1280.webp",
    };

    it("малый запрос → w640", () => {
      expect(pickVariantUrlForRequestedWidth(v, 320)).toBe("/640.webp");
    });

    it("запрос 720 → w960", () => {
      expect(pickVariantUrlForRequestedWidth(v, 720)).toBe("/960.webp");
    });

    it("запрос 1200 → w1280", () => {
      expect(pickVariantUrlForRequestedWidth(v, 1200)).toBe("/1280.webp");
    });

    it("запрос больше пресетов → максимальный URL", () => {
      expect(pickVariantUrlForRequestedWidth(v, 2000)).toBe("/1280.webp");
    });

    it("нет w640 — берётся следующий подходящий", () => {
      expect(
        pickVariantUrlForRequestedWidth(
          { w960: "/a", w1280: "/b" },
          400,
        ),
      ).toBe("/a");
    });
  });
});
