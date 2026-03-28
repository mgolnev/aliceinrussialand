"use client";

import { useEffect } from "react";
import { saveFeedScrollPosition } from "@/lib/feed-scroll";

/**
 * Любой переход на /p/... с главной должен сохранить scroll (не только пункт меню).
 */
export function FeedScrollLinkCapture() {
  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/p/")) return;
      saveFeedScrollPosition();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}
