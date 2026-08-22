/** Плашка как у кнопки «Контакты» в шапке (`SiteChrome`). */
export function chromePlaqueButtonClass(): string {
  return [
    "shrink-0 rounded-full border border-stone-200 bg-white",
    "px-3 py-2 text-[13px] font-semibold text-stone-800 ",
    "transition-colors hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97]",
    "sm:px-4 sm:text-sm",
  ].join(" ");
}

/** Единая геометрия второй строки публичной шапки: категории, «Назад», skeleton. */
export const headerTrayClass =
  "relative flex items-center gap-1 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden";

/** Общий вид «папок» (админка, лента, выбор категории в редакторе). */
export function pillTabClass(active: boolean): string {
  return [
    "shrink-0 rounded-site-control border px-3 py-2 text-[13px] font-semibold transition-all sm:text-sm",
    active
      ? "border-stone-200 bg-white text-stone-900"
      : "border-transparent text-stone-500 hover:bg-white/70 hover:text-stone-800",
  ].join(" ");
}
