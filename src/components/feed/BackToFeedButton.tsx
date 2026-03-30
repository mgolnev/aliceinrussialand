"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { chromePlaqueButtonClass, pillTabClass } from "@/lib/pill-tab-styles";

type Variant = "pill" | "plaque";

/**
 * «Назад» с иконкой: как браузерный «назад», если в истории есть предыдущая страница;
 * иначе — переход на главную (`/` без фильтра категории).
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
        className={`relative inline-flex items-center gap-0.5 ${pillTabClass(true)}`}
        aria-label="Назад"
      >
        <ChevronLeft
          size={18}
          strokeWidth={2.25}
          className="-ml-0.5 shrink-0 opacity-85"
          aria-hidden
        />
        Назад
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`relative inline-flex items-center gap-0.5 ${chromePlaqueButtonClass()}`}
      aria-label="Назад"
    >
      <ChevronLeft
        size={18}
        strokeWidth={2.25}
        className="-ml-0.5 shrink-0 opacity-85"
        aria-hidden
      />
      Назад
    </button>
  );
}
