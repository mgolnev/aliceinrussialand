"use client";

import Link from "next/link";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";

export function AdminSiteExitLink() {
  return (
    <Link
      href="/"
      prefetch
      scroll={false}
      className="relative shrink-0 rounded-full border border-stone-200 bg-white px-3 py-2 text-[13px] font-semibold text-stone-800 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] sm:px-4 sm:text-sm"
    >
      На сайт
      <LinkPendingBackdrop />
    </Link>
  );
}
