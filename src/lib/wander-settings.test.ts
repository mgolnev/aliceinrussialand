import { describe, expect, it } from "vitest";
import {
  normalizeWanderEntryLabel,
  DEFAULT_WANDER_ENTRY_SUBTITLE,
  normalizeWanderEntrySubtitle,
  normalizeWanderExcludedCategoryIds,
} from "./wander-settings";

describe("настройки категорий прогулки", () => {
  it("нормализует надпись входа", () => {
    expect(normalizeWanderEntryLabel("  не жми сюда  ")).toBe("не жми сюда");
    expect(normalizeWanderEntryLabel(" ")).toBeNull();
    expect(normalizeWanderEntryLabel("x".repeat(61))).toBeNull();
  });

  it("нормализует уникальные исключения в сохранённом порядке", () => {
    expect(normalizeWanderExcludedCategoryIds(["seen", "seen", "ceramics"]))
      .toEqual(["seen", "ceramics"]);
  });

  it("нормализует подпись и ограничивает её длину", () => {
    expect(normalizeWanderEntrySubtitle(`  ${DEFAULT_WANDER_ENTRY_SUBTITLE}  `))
      .toBe(DEFAULT_WANDER_ENTRY_SUBTITLE);
    expect(normalizeWanderEntrySubtitle("x".repeat(160))).toHaveLength(160);
    for (const value of [" ", "x".repeat(161), null, 42, {}, undefined]) {
      expect(normalizeWanderEntrySubtitle(value)).toBeNull();
    }
  });

  it("не принимает пустые и повреждённые ID", () => {
    expect(normalizeWanderExcludedCategoryIds([""])).toBeNull();
    expect(normalizeWanderExcludedCategoryIds(["seen", 42])).toBeNull();
  });

  it("отклоняет не-массив и слишком большой список", () => {
    expect(normalizeWanderExcludedCategoryIds("seen")).toBeNull();
    expect(normalizeWanderExcludedCategoryIds(Array.from({ length: 501 }, (_, i) => `c${i}`)))
      .toBeNull();
  });
});
