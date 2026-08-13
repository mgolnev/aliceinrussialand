import { describe, expect, it } from "vitest";
import { normalizeProjectPostIds } from "./project-post-ids";

describe("normalizeProjectPostIds", () => {
  it("keeps the author-selected order and removes repeated ids", () => {
    expect(normalizeProjectPostIds(["post-a", "post-b", "post-a", " post-c "]))
      .toEqual(["post-a", "post-b", "post-c"]);
  });

  it("rejects a malformed selection", () => {
    expect(normalizeProjectPostIds("post-a")).toBeNull();
    expect(normalizeProjectPostIds(["post-a", 2])).toBeNull();
  });
});
