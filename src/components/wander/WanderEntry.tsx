"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WANDER_STORAGE_KEY } from "@/lib/wander";

export function WanderEntry() {
  const router = useRouter();
  const timer = useRef<number | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function enter() {
    if (leaving) return;
    setLeaving(true);
    try { sessionStorage.removeItem(WANDER_STORAGE_KEY); } catch { /* A new walk still starts when storage is blocked. */ }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => router.push("/wander"), reducedMotion ? 0 : 420);
  }

  return (
    <div className="mb-8 border-y border-stone-300/70 py-5 text-center sm:mb-12 sm:py-7">
      <button
        type="button"
        onClick={enter}
        disabled={leaving}
        className="min-h-11 min-w-32 text-sm tracking-[0.08em] text-stone-600 transition-[color,letter-spacing] duration-300 hover:tracking-[0.12em] hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default disabled:text-stone-900"
        aria-live="polite"
      >
        {leaving ? "точно?" : "не выбирай"}
      </button>
    </div>
  );
}
