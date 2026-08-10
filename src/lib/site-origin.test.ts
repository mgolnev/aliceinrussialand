import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSiteOrigin } from "./site-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveSiteOrigin", () => {
  it("does not emit localhost in production sitemap URLs", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    expect(resolveSiteOrigin("http://localhost:3000")).toBe(
      "https://aliceinrussialand.ru",
    );
  });

  it("keeps a local origin during development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    expect(resolveSiteOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });
});
