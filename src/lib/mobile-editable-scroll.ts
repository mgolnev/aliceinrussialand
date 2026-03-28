import type { FocusEvent } from "react";

/**
 * Мобильные браузеры: после открытия клавиатуры поле часто оказывается под ней.
 * Прокручиваем к центру видимой области. Без `behavior: "smooth"` и без сырого
 * resize на каждый кадр — иначе окно «долго ищет место».
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
      behavior: "auto",
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
    window.setTimeout(() => scrollIntoViewCenter(el), 48),
    window.setTimeout(() => scrollIntoViewCenter(el), 200),
  ];
  const vv = window.visualViewport;
  let vvOff: (() => void) | undefined;
  if (vv) {
    let debounceId: number | null = null;
    const onResize = () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        scrollIntoViewCenter(el);
        debounceId = null;
      }, 100);
    };
    vv.addEventListener("resize", onResize);
    vvOff = () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      vv.removeEventListener("resize", onResize);
    };
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
