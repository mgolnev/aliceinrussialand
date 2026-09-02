import { describe, expect, it } from "vitest";
import {
  normalizeWanderEntryLabel,
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
