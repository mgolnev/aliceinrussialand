import { describe, expect, it } from "vitest";
import { getLegacyPublicRedirect } from "./legacy-public-redirects";

describe("getLegacyPublicRedirect", () => {
  it("находит только известные старые публичные адреса", () => {
    expect(getLegacyPublicRedirect("/category/illyustraciya")).toBe(
      "/category/grafika",
    );
    expect(getLegacyPublicRedirect("/p/novaya-publikaciya-6")).toBe(
      "/p/grafika-s-plenera-pejzazh-u-vody",
    );
    expect(getLegacyPublicRedirect("/p/does-not-exist")).toBeNull();
  });
});
