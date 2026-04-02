"use client";

import { useEffect } from "react";
import { saveFeedBackNavigation } from "@/lib/feed-scroll";
import { getFeedScrollBridgeSnapshot } from "@/lib/feed-scroll-bridge";

/**
 * Сохраняем scroll и снимок списка только при уходе с главной на пост.
 * На странице поста не пишем в sessionStorage — иначе тап по рекомендациям
 * сохраняет «низ длинного поста» и ломает восстановление при возврате на /.
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
      if (typeof window === "undefined") return;
      if (window.location.pathname.startsWith("/p/")) return;
      const snap = getFeedScrollBridgeSnapshot();
      saveFeedBackNavigation({
        y: window.scrollY,
        category: snap.categorySlug,
        postIds: snap.postIds,
      });
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}
