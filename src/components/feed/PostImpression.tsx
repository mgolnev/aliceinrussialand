"use client";

import { useEffect, useRef } from "react";

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
};

export function PostImpression({ slug, plausibleDomain }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!plausibleDomain || fired.current) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.45) {
            fired.current = true;
            window.plausible?.("PostView", { props: { slug } });
            io.disconnect();
          }
        }
      },
      { threshold: [0.45, 0.6] },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [slug, plausibleDomain]);

  return <div ref={ref} className="absolute inset-0 pointer-events-none" aria-hidden />;
}
