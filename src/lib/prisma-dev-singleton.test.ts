import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("prisma.ts — опциональный dev singleton", () => {
  it("документирован PRISMA_DEV_SINGLETON и ветка production", () => {
    const raw = readFileSync(
      path.join(process.cwd(), "src/lib/prisma.ts"),
      "utf8",
    );
    expect(raw).toMatch(/PRISMA_DEV_SINGLETON/);
    expect(raw).toMatch(/NODE_ENV === "production"/);
    expect(raw).toMatch(/devSingleton/);
  });
});
