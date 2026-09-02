import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("миграция настроек «не выбирай»", () => {
  it("добавляет подпись, не меняя сохранённый заголовок", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "prisma/migrations/20260902210000_wander_entry_subtitle/migration.sql"),
      "utf8",
    );
    expect(sql).toContain('ALTER TABLE "SiteSettings"');
    expect(sql).toContain('ADD COLUMN "wanderEntrySubtitle" TEXT NOT NULL');
    expect(sql).toContain("DEFAULT 'серьёзно. неизвестно, куда попадёшь'");
    expect(sql).not.toMatch(/UPDATE|DELETE|DROP/i);
  });

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

  it("добавляет редактируемую надпись входа", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260902130000_wander_entry_label/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain('ALTER TABLE "SiteSettings"');
    expect(sql).toContain('"wanderEntryLabel" TEXT NOT NULL');
    expect(sql).toContain("DEFAULT 'не нажимай сюда'");
  });

  it("переводит стандартную надпись на авторский векторный вариант", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260902150000_wander_handwritten_entry/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("SET \"wanderEntryLabel\" = 'не жми сюда'");
    expect(sql).toContain("WHERE \"wanderEntryLabel\" = 'не нажимай сюда'");
    expect(sql).toContain("SET DEFAULT 'не жми сюда'");
  });
});
