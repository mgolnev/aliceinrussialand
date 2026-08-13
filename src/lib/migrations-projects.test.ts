import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("миграция циклов", () => {
  it("создаёт цикл, связь с постом и порядок чтения", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260814120000_projects/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain('CREATE TABLE "Project"');
    expect(sql).toContain('CREATE TABLE "PostProject"');
    expect(sql).toContain('"sortOrder" INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain('"PostProject_postId_projectId_key"');
  });
});
