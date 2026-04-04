import { describe, expect, it } from "vitest";
import {
  buildMediaGridLayout,
  type GridImage,
  type MediaGridLayout,
} from "./MediaGrid";

function assertRows(
  L: MediaGridLayout,
): asserts L is Extract<MediaGridLayout, { kind: "rows" }> {
  expect(L.kind).toBe("rows");
}

function imgs(n: number): GridImage[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `img-${i}`,
    alt: "",
  }));
}

describe("buildMediaGridLayout", () => {
  it("для 3 фото даёт три разных шаблона при переборе seed", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const L = buildMediaGridLayout(imgs(3), `post-${i}`);
      expect(L.kind).toBe("rows");
      keys.add(JSON.stringify(L));
    }
    expect(keys.size).toBe(3);
  });

  it("для 4 фото встречаются и grid4, и два ряда по 2", () => {
    let grid4 = 0;
    let rows22 = 0;
    for (let i = 0; i < 400; i++) {
      const L = buildMediaGridLayout(imgs(4), `post-${i}`);
      if (L.kind === "grid4") grid4 += 1;
      if (L.kind === "rows" && L.rows.length === 2) {
        expect(L.rows[0]!.indices.length).toBe(2);
        expect(L.rows[1]!.indices.length).toBe(2);
        rows22 += 1;
      }
    }
    expect(grid4).toBeGreaterThan(0);
    expect(rows22).toBeGreaterThan(0);
  });

  it("для 7 фото — чередование [3,2,2] и [2,3,2]", () => {
    const patterns = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const L = buildMediaGridLayout(imgs(7), `post-${i}`);
      assertRows(L);
      const lens = L.rows.map((r) => r.indices.length).join(",");
      patterns.add(lens);
    }
    expect(patterns.has("3,2,2")).toBe(true);
    expect(patterns.has("2,3,2")).toBe(true);
  });

  it("для 1–2 фото без регрессии", () => {
    const L1 = buildMediaGridLayout(imgs(1), "x");
    expect(L1).toEqual({
      kind: "rows",
      rows: [{ indices: [0], flex: [1] }],
    });
    const L2 = buildMediaGridLayout(imgs(2), "x");
    assertRows(L2);
    expect(L2.rows).toHaveLength(1);
    expect(L2.rows[0]!.indices).toEqual([0, 1]);
    expect(L2.rows[0]!.flex).toEqual([1, 1]);
  });
});
