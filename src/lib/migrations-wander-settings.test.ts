import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("миграция настроек «не выбирай»", () => {
  it("добавляет категориям признак участия с безопасным дефолтом", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260902110000_wander_category_exclusions/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain('ALTER TABLE "PostCategory"');
    expect(sql).toContain('"includeInWander" BOOLEAN NOT NULL DEFAULT true');
  });
});
