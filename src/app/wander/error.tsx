"use client";

import Link from "next/link";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#faf8f5] px-6 text-center">
      <h1 className="text-2xl tracking-tight">прогулка пока не загрузилась</h1>
      <button type="button" onClick={reset} className="min-h-11 text-sm underline underline-offset-4">попробовать ещё раз →</button>
      <Link href="/" className="py-3 text-xs text-stone-600">выйти к ленте ↗</Link>
    </main>
  );
}
