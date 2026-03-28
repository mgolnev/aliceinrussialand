import type { FocusEvent } from "react";

/**
 * Мобильные браузеры: после открытия клавиатуры поле часто оказывается под ней.
 * Прокручиваем к центру видимой области + повтор после анимации клавиатуры и visualViewport.
 */
type FieldScrollState = {
  timeouts: number[];
  vvOff?: () => void;
};

const fieldState = new WeakMap<HTMLElement, FieldScrollState>();

function isNarrowMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 640px)").matches;
}

function scrollIntoViewCenter(el: HTMLElement) {
  try {
    el.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  } catch {
    /* ignore */
  }
}

export function handleMobileEditableFocus(e: FocusEvent<HTMLElement>): void {
  if (!isNarrowMobile()) return;
  const el = e.currentTarget;
  scrollIntoViewCenter(el);
  const timeouts: number[] = [
    window.setTimeout(() => scrollIntoViewCenter(el), 120),
    window.setTimeout(() => scrollIntoViewCenter(el), 400),
  ];
  const vv = window.visualViewport;
  let vvOff: (() => void) | undefined;
  if (vv) {
    const onResize = () => scrollIntoViewCenter(el);
    vv.addEventListener("resize", onResize);
    vvOff = () => vv.removeEventListener("resize", onResize);
  }
  fieldState.set(el, { timeouts, vvOff });
}

export function handleMobileEditableBlur(e: FocusEvent<HTMLElement>): void {
  const el = e.currentTarget;
  const st = fieldState.get(el);
  if (!st) return;
  st.timeouts.forEach((id) => clearTimeout(id));
  st.vvOff?.();
  fieldState.delete(el);
}
