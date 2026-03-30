"use client";

import { useLinkStatus } from "next/link";

/** Полупрозрачный слой поверх родительского `<Link>`, пока идёт клиентский переход. */
export function LinkPendingBackdrop() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="pointer-events-none absolute inset-0 z-[5] rounded-[inherit] bg-stone-200/40 motion-safe:animate-pulse"
      aria-hidden
    />
  );
}
