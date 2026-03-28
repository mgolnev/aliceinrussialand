import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("миграция индекса ленты", () => {
  it("содержит CREATE INDEX для status, pinned, publishedAt", () => {
    const sqlPath = path.join(
      process.cwd(),
      "prisma/migrations/20260328150000_post_feed_sort_index/migration.sql",
    );
    const sql = readFileSync(sqlPath, "utf8");
    expect(sql).toMatch(/CREATE INDEX/i);
    expect(sql).toMatch(/Post_status_pinned_publishedAt_idx/);
    expect(sql).toMatch(/publishedAt.*DESC/i);
  });
});
