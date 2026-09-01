"use client";

import Link from "next/link";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-[#faf8f5] px-6 text-center">
      <h1 className="text-2xl tracking-tight">прогулка пока не загрузилась</h1>
      <button type="button" onClick={reset} className="min-h-11 text-sm underline underline-offset-4">ещё раз</button>
      <Link href="/" aria-label="выйти" className="fixed right-5 top-4 grid size-11 place-items-center text-2xl font-light text-stone-600">×</Link>
    </main>
  );
}
