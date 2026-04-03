"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const scrollStorageKey = (pathname: string) => `alice:scroll-y:${pathname}`;
const NAV_STATE_KEY = "alice:nav-state";

type NavState = {
  mode: "history" | "push";
  targetPath: string;
  ts: number;
};

function readNavState(): NavState | null {
  try {
    const raw = sessionStorage.getItem(NAV_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const mode = (parsed as { mode?: unknown }).mode;
    const targetPath = (parsed as { targetPath?: unknown }).targetPath;
    const ts = (parsed as { ts?: unknown }).ts;
    if ((mode !== "history" && mode !== "push") || typeof targetPath !== "string") {
      return null;
    }
    if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
    return { mode, targetPath, ts };
  } catch {
    return null;
  }
}

function writeNavState(state: NavState) {
  try {
    sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function clearNavState() {
  try {
    sessionStorage.removeItem(NAV_STATE_KEY);
  } catch {
    /* ignore */
  }
}

function scheduleRestoreScroll(y: number) {
  const apply = () => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    html.style.scrollBehavior = prev;
  };

  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const until = performance.now() + 350;
        const tick = () => {
          apply();
          if (performance.now() < until) requestAnimationFrame(tick);
        };
        tick();
      });
    });
  });
}

/**
 * Универсальное управление скроллом для всех страниц.
 * Контракт UX:
 * - обычный переход (тап/ссылка) → всегда в начало страницы;
 * - back/forward по истории браузера → восстановление позиции скролла.
 */
export function GlobalScrollManager() {
  const pathname = usePathname();

  // Отслеживаем тип навигации: history (назад/вперёд) или push (обычный переход)
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      writeNavState({
        mode: "history",
        targetPath: path,
        ts: Date.now(),
      });
    };

    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      let to: URL;
      try {
        to = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (to.origin !== window.location.origin) return;
      
      writeNavState({
        mode: "push",
        targetPath: to.pathname,
        ts: Date.now(),
      });
    };

    window.addEventListener("popstate", onPop);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  // Сохраняем позицию скролла при уходе со страницы
  useLayoutEffect(() => {
    const key = scrollStorageKey(pathname);
    const startedAt = performance.now();
    let lastY = window.scrollY;

    const onScroll = () => {
      lastY = window.scrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      const lifetimeMs = performance.now() - startedAt;
      const skipZeroClobber = lastY === 0 && lifetimeMs < 120;
      if (skipZeroClobber) return;
      try {
        sessionStorage.setItem(key, String(lastY));
      } catch {
        /* ignore */
      }
    };
  }, [pathname]);

  // Применяем скролл при заходе на страницу
  useLayoutEffect(() => {
    const navState = readNavState();
    clearNavState();
    const isFresh = navState ? Date.now() - navState.ts < 15000 : false;
    const shouldRestore =
      Boolean(navState) &&
      navState?.mode === "history" &&
      navState.targetPath === pathname &&
      isFresh;

    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    if (shouldRestore) {
      let raw: string | null = null;
      const key = scrollStorageKey(pathname);
      try {
        raw = sessionStorage.getItem(key);
      } catch {
        /* ignore */
      }
      const y = raw != null ? Number.parseInt(raw, 10) : NaN;
      const hasSaved = Number.isFinite(y) && y >= 0;
      if (hasSaved) {
        scheduleRestoreScroll(y);
      } else {
        window.scrollTo(0, 0);
      }
      html.style.scrollBehavior = prevBehavior;
      return;
    }

    // Обычные переходы → в начало страницы
    window.scrollTo(0, 0);
    html.style.scrollBehavior = prevBehavior;
  }, [pathname]);

  return null;
}