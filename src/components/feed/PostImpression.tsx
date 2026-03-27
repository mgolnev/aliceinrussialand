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
  slug: string;
  plausibleDomain?: string;
  yandexMetrikaId?: string;
};

export function PostImpression({
  slug,
  plausibleDomain,
  yandexMetrikaId,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if ((!plausibleDomain && !yandexMetrikaId?.trim()) || fired.current) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.45) {
            fired.current = true;
            window.plausible?.("PostView", { props: { slug } });
            ymReachGoal(yandexMetrikaId, "post_feed_view", { slug });
            io.disconnect();
          }
        }
      },
      { threshold: [0.45, 0.6] },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [slug, plausibleDomain, yandexMetrikaId]);

  return <div ref={ref} className="absolute inset-0 pointer-events-none" aria-hidden />;
}
