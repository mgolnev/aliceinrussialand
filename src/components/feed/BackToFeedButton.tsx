"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { chromePlaqueButtonClass, pillTabClass } from "@/lib/pill-tab-styles";

type Variant = "pill" | "plaque";

/**
 * «← Лента»: как браузерный «назад», если в истории есть предыдущая страница;
 * иначе — переход на главную ленту «Все» (`/` без фильтра категории).
 */
export function BackToFeedButton({ variant }: { variant: Variant }) {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={goBack}
        className={`relative ${pillTabClass(true)}`}
        aria-label="Назад к ленте"
      >
        ← Лента
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={chromePlaqueButtonClass()}
      aria-label="Назад к ленте"
    >
      ← Лента
    </button>
  );
}
