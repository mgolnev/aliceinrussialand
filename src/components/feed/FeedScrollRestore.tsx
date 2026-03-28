"use client";

import { useLayoutEffect } from "react";
import { consumeFeedScrollPosition } from "@/lib/feed-scroll";

/** Восстанавливает scroll после возврата с /p/... на главную. */
export function FeedScrollRestore() {
  useLayoutEffect(() => {
    const y = consumeFeedScrollPosition();
    if (y == null) return;
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    html.style.scrollBehavior = prev;
  }, []);

  return null;
}
