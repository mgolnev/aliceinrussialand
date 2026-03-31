"use client";

import { useEffect, useRef } from "react";
import { ymReachGoal } from "@/lib/yandex-metrika";

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}

type Props = {
  plausibleDomain?: string;
  yandexMetrikaId?: string;
};

export function ScrollMetrics({ plausibleDomain, yandexMetrikaId }: Props) {
  const sent = useRef(false);

  useEffect(() => {
    if (!plausibleDomain && !yandexMetrikaId?.trim()) return;
    let onScroll: (() => void) | null = null;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const setup = () => {
      onScroll = () => {
        if (sent.current) return;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        if (max <= 0) return;
        const ratio = window.scrollY / max;
        if (ratio >= 0.65) {
          sent.current = true;
          window.plausible?.("ScrollDepth", { props: { depth: "65" } });
          ymReachGoal(yandexMetrikaId, "scroll_depth", { depth: "65" });
          if (onScroll) window.removeEventListener("scroll", onScroll);
        }
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(setup, { timeout: 2000 });
    } else {
      timeoutId = globalThis.setTimeout(setup, 800);
    }

    return () => {
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
      }
      if (onScroll) {
        window.removeEventListener("scroll", onScroll);
      }
    };
  }, [plausibleDomain, yandexMetrikaId]);

  return null;
}
