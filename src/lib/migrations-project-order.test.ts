import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("миграция порядка подборок", () => {
  it("задаёт существующим подборкам новый-first режим по умолчанию", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260816090000_project_order_mode/migration.sql",
      ),
      "utf8",
    );

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "orderMode" TEXT NOT NULL DEFAULT \'NEWEST_FIRST\'');
  });
});
