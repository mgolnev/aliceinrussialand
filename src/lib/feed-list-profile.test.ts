import { describe, expect, it } from "vitest";
import type { FeedPost } from "@/types/feed";
import {
  applyPublicFeedListLimits,
  FEED_PUBLIC_BODY_MAX_CHARS,
  FEED_PUBLIC_MAX_IMAGES_PER_POST,
  truncateBodyForPublicFeed,
  trimImageVariantsForPublicList,
} from "./feed-list-profile";

function samplePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p1",
    slug: "s",
    title: "t",
    body: "hello",
    displayMode: "GRID",
    publishedAt: null,
    pinned: false,
    categoryId: null,
    category: null,
    images: [],
    ...overrides,
  };
}

describe("feed list profile (public)", () => {
  it("trimImageVariantsForPublicList оставляет только w640/w960/w1280", () => {
    expect(
      trimImageVariantsForPublicList({
        w512: "/a",
        w640: "/b",
        w960: "/c",
        w1280: "/d",
        extra: "/x",
      }),
    ).toEqual({ w640: "/b", w960: "/c", w1280: "/d" });
  });

  it("truncateBodyForPublicFeed не режет короткий текст", () => {
    expect(truncateBodyForPublicFeed("abc")).toBe("abc");
  });

  it("truncateBodyForPublicFeed добавляет многоточие при превышении лимита", () => {
    const long = "x".repeat(FEED_PUBLIC_BODY_MAX_CHARS + 50);
    const out = truncateBodyForPublicFeed(long);
    expect(out.length).toBeLessThanOrEqual(FEED_PUBLIC_BODY_MAX_CHARS + 2);
    expect(out.endsWith("…")).toBe(true);
  });

  it("applyPublicFeedListLimits режет images до N и body", () => {
    const post = samplePost({
      body: "y".repeat(FEED_PUBLIC_BODY_MAX_CHARS + 10),
      images: [
        {
          id: "i1",
          caption: "",
          alt: "",
          variants: { w640: "/1", w512: "/bad" },
          width: 100,
          height: 100,
        },
        {
          id: "i2",
          caption: "",
          alt: "",
          variants: { w960: "/2" },
          width: 100,
          height: 100,
        },
      ],
    });
    const slim = applyPublicFeedListLimits(post);
    expect(slim.images).toHaveLength(FEED_PUBLIC_MAX_IMAGES_PER_POST);
    expect("w512" in slim.images[0]!.variants).toBe(false);
    expect(slim.body.length).toBeLessThanOrEqual(FEED_PUBLIC_BODY_MAX_CHARS + 2);
  });

  it("публичный слой JSON строго легче «толстого» при том же посте", () => {
    const fat = samplePost({
      body: "z".repeat(25_000),
      images: Array.from({ length: 5 }, (_, i) => ({
        id: `im${i}`,
        caption: "",
        alt: "",
        variants: {
          w512: `/s${i}`,
          w640: `/m${i}`,
          w960: `/l${i}`,
          w1280: `/x${i}`,
        },
        width: 800,
        height: 600,
      })),
    });
    const slim = applyPublicFeedListLimits(fat);
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(fat).length);
  });
});
