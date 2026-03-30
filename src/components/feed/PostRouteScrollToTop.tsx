"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * При клиентском переходе между /p/[slug] Next может сохранять scroll.
 * Сбрасываем в начало при каждой смене URL поста.
 */
export function PostRouteScrollToTop() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    if (!pathname.startsWith("/p/")) return;
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    html.style.scrollBehavior = prev;
  }, [pathname]);
  return null;
}
