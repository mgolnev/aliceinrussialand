import Link from "next/link";

export default function Loading() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#faf8f5] px-6 text-stone-600">
      <p role="status" className="text-sm">сейчас найдётся что-нибудь</p>
      <Link href="/" className="py-3 text-xs underline underline-offset-4">выйти к ленте ↗</Link>
    </main>
  );
}
