import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("next.config — изображения (фаза 2)", () => {
  it("remotePatterns для Supabase Storage + optimizePackageImports", () => {
    const raw = readFileSync(
      path.join(process.cwd(), "next.config.ts"),
      "utf8",
    );
    expect(raw).toMatch(/remotePatterns/);
    expect(raw).toMatch(/supabase\.co/);
    expect(raw).toMatch(/storage\/v1\/object\/public/);
    expect(raw).toMatch(/optimizePackageImports/);
    expect(raw).toMatch(/poweredByHeader/);
  });
});
