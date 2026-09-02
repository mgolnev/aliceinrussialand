"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { WANDER_STORAGE_KEY } from "@/lib/wander";
import { DEFAULT_WANDER_ENTRY_LABEL, DEFAULT_WANDER_ENTRY_SUBTITLE } from "@/lib/wander-settings";

export function WanderEntry({ label, subtitle }: { label?: string; subtitle?: string }) {
  const router = useRouter();
  const id = useId();
  const [leaving, setLeaving] = useState(false);
  const entryLabel = label?.trim() || DEFAULT_WANDER_ENTRY_LABEL;
  const entrySubtitle = subtitle?.trim() || DEFAULT_WANDER_ENTRY_SUBTITLE;

  function enter() {
    if (leaving) return;
    setLeaving(true);
    try { sessionStorage.removeItem(WANDER_STORAGE_KEY); } catch { /* A new walk still starts when storage is blocked. */ }
    router.push("/wander");
  }

  return (
    <div className="mb-3 text-center sm:mb-4">
      <button
        type="button"
        onClick={enter}
        disabled={leaving}
        className="flex w-full cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent px-2 py-4 text-center shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-500 disabled:cursor-wait sm:py-5"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-subtitle`}
        aria-busy={leaving}
      >
        <span id={`${id}-label`} className="max-w-full text-lg leading-snug font-normal text-stone-600 [overflow-wrap:anywhere] sm:text-xl">
          {entryLabel}
        </span>
        <span id={`${id}-subtitle`} className="max-w-full text-[13px] leading-relaxed font-normal text-stone-500 [overflow-wrap:anywhere] sm:text-sm">
          {entrySubtitle}
        </span>
      </button>
    </div>
  );
}
