import Link from "next/link";

export default function Loading() {
  return (
    <main className="relative min-h-svh bg-[#faf8f5]">
      <p role="status" className="sr-only">начинается прогулка</p>
      <Link href="/" aria-label="выйти" className="fixed right-5 top-4 grid size-11 place-items-center text-2xl font-light text-stone-600">×</Link>
    </main>
  );
}
