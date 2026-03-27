"use client";

import { useLayoutEffect } from "react";
import { consumeFeedScrollPosition } from "@/lib/feed-scroll";

/** Восстанавливает scroll после возврата с /p/... на главную. */
export function FeedScrollRestore() {
  useLayoutEffect(() => {
    const y = consumeFeedScrollPosition();
    if (y != null) {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }
  }, []);

  return null;
}
