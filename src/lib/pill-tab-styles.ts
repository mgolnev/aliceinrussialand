/** Общий вид «папок» (админка, лента, выбор категории в редакторе). */
export function pillTabClass(active: boolean): string {
  return [
    "shrink-0 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all sm:text-sm",
    active
      ? "bg-white text-stone-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_3px_10px_rgba(0,0,0,0.05)] ring-1 ring-stone-200/80"
      : "text-stone-500 hover:bg-white/70 hover:text-stone-800",
  ].join(" ");
}
