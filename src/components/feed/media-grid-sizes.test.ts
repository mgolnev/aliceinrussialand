import { describe, expect, it } from "vitest";
import { slotSizesFromWidthFraction } from "./MediaGrid";

describe("slotSizesFromWidthFraction", () => {
  it("полная ширина карточки совпадает с прежним описанием ленты", () => {
    expect(slotSizesFromWidthFraction(1)).toBe(
      "(max-width: 640px) 100vw, (max-width: 1100px) 92vw, 768px",
    );
  });

  it("треть ряда даёт ~33vw на узком экране", () => {
    expect(slotSizesFromWidthFraction(1 / 3)).toBe(
      "(max-width: 640px) 33.33vw, (max-width: 1100px) 30.67vw, 256px",
    );
  });

  it("две колонки 40/60 → 40vw и 60vw от 100vw", () => {
    expect(slotSizesFromWidthFraction(2 / 5)).toBe(
      "(max-width: 640px) 40vw, (max-width: 1100px) 36.8vw, 307px",
    );
    expect(slotSizesFromWidthFraction(3 / 5)).toBe(
      "(max-width: 640px) 60vw, (max-width: 1100px) 55.2vw, 461px",
    );
  });
});
