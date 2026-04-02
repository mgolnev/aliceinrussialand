"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Сохранённый scrollY для страницы поста (при manual scroll restoration). */
const scrollStorageKey = (pathname: string) => `alice:post-scroll-y:${pathname}`;

/**
 * Не сравниваем pathname из popstate с usePathname(): при событии URL иногда
 * ещё не тот, из‑за этого восстановление не срабатывало.
 */
const FROM_HISTORY_KEY = "alice:post-from-history";

const READ_NEXT_SECTION_ID = "post-read-next-heading";

function scheduleAfterLayout(cb: () => void) {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(cb);
    });
  });
}

function restoreScrollRepeatedly(
  targetPath: string,
  y: number,
  useAnchorFallback: boolean,
) {
  const apply = () => {
    if (window.location.pathname !== targetPath) return;
    if (useAnchorFallback) {
      const el = document.getElementById(READ_NEXT_SECTION_ID);
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "auto" });
      }
      return;
    }
    window.scrollTo(0, y);
  };

  scheduleAfterLayout(() => {
    try {
      sessionStorage.removeItem(FROM_HISTORY_KEY);
    } catch {
      /* ignore */
    }

    apply();

    if (useAnchorFallback) {
      window.setTimeout(apply, 0);
      window.setTimeout(apply, 50);
      window.setTimeout(apply, 120);
      return;
    }

    const until = performance.now() + 500;
    const tick = () => {
      if (window.location.pathname !== targetPath) return;
      if (performance.now() > until) return;
      window.scrollTo(0, y);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.setTimeout(() => {
      if (window.location.pathname !== targetPath) return;
      window.scrollTo(0, y);
    }, 0);
    window.setTimeout(() => {
      if (window.location.pathname !== targetPath) return;
      window.scrollTo(0, y);
    }, 48);
    window.setTimeout(() => {
      if (window.location.pathname !== targetPath) return;
      window.scrollTo(0, y);
    }, 120);
  });
}

/**
 * При клиентском переходе между /p/[slug] без восстановления скролла браузером
 * (в корне history.scrollRestoration = manual) поднимаем страницу в начало.
 * При «Назад»/«Вперёд» по истории восстанавливаем scrollY; если значение не
 * сохраняли — скроллим к блоку «дальше читайте» (#post-read-next-heading).
 */
export function PostRouteScrollToTop() {
  const pathname = usePathname();
  /** Только push очищает флаг: после «Назад» Next шлёт `replace`, иначе ломаем восстановление (см. логи H1). */
  const navigationPatchedRef = useRef(false);

  useLayoutEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      try {
        if (path.startsWith("/p/")) {
          sessionStorage.setItem(FROM_HISTORY_KEY, "1");
        } else {
          sessionStorage.removeItem(FROM_HISTORY_KEY);
        }
      } catch {
        /* quota / private mode */
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** Сброс флага только при push (переход по ссылке). Next после back делает replace — его не трогаем. */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const nav = window.navigation;
    if (!nav?.addEventListener || navigationPatchedRef.current) return;
    navigationPatchedRef.current = true;

    const onNavigate = (event: Event) => {
      const e = event as Event & { navigationType?: string };
      const t = e.navigationType;
      const clearsFlag = t === "push";
      /** popstate в логах часто не успевает до layout; traverse приходит раньше (см. пост-фикс логи). */
      const setsHistoryFlag = t === "traverse";
      if (setsHistoryFlag) {
        try {
          sessionStorage.setItem(FROM_HISTORY_KEY, "1");
        } catch {
          /* ignore */
        }
      }
      if (clearsFlag) {
        try {
          sessionStorage.removeItem(FROM_HISTORY_KEY);
        } catch {
          /* ignore */
        }
      }
    };

    nav.addEventListener("navigate", onNavigate);
    return () => {
      navigationPatchedRef.current = false;
      nav.removeEventListener("navigate", onNavigate);
    };
  }, []);

  /**
   * Cleanup layout до эффектов Next: useEffect cleanup выполнялся после scrollTop=0,
   * в session попадал 0 (логи H2).
   */
  useLayoutEffect(() => {
    if (!pathname.startsWith("/p/")) return;

    const key = scrollStorageKey(pathname);
    const effectStartedAt = performance.now();
    let lastY = window.scrollY;

    const onScroll = () => {
      lastY = window.scrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      const lifetimeMs = performance.now() - effectStartedAt;
      /** React Strict / двойной проход: cleanup с lastY=0 сразу после mount затирал сохранённый скролл (лог стр.17). */
      const skipZeroClobber = lastY === 0 && lifetimeMs < 120;
      if (!skipZeroClobber) {
        try {
          sessionStorage.setItem(key, String(lastY));
        } catch {
          /* ignore */
        }
      }
    };
  }, [pathname]);

  useLayoutEffect(() => {
    if (!pathname.startsWith("/p/")) return;

    let fromHistory = false;
    try {
      fromHistory = sessionStorage.getItem(FROM_HISTORY_KEY) === "1";
    } catch {
      /* ignore */
    }

    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    if (fromHistory) {
      const targetPath =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/p/")
          ? window.location.pathname
          : pathname;
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(scrollStorageKey(targetPath));
      } catch {
        /* ignore */
      }
      const y = raw != null ? Number.parseInt(raw, 10) : NaN;
      const hasSaved = raw != null && !Number.isNaN(y) && y >= 0;
      const useAnchorFallback = !hasSaved;
      const restoreY = hasSaved ? y : 0;

      restoreScrollRepeatedly(targetPath, restoreY, useAnchorFallback);

      html.style.scrollBehavior = prevBehavior;
      return;
    }

    window.scrollTo(0, 0);
    html.style.scrollBehavior = prevBehavior;
  }, [pathname]);

  return null;
}
