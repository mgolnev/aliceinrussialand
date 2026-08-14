import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("миграция поиска публикаций", () => {
  it("переводит текстовые поля поиска на Unicode ICU-сортировку", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260814200000_post_search_icu_collation/migration.sql",
      ),
      "utf8",
    );

    expect(sql).toContain('ALTER COLUMN "title" TYPE TEXT COLLATE "und-x-icu"');
    expect(sql).toContain('ALTER COLUMN "slug" TYPE TEXT COLLATE "und-x-icu"');
    expect(sql).toContain('ALTER COLUMN "body" TYPE TEXT COLLATE "und-x-icu"');
  });
});
