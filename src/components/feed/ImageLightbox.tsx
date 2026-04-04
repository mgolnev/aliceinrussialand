"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShareForwardIcon } from "@/components/ui/ShareForwardIcon";

export type LightboxSlide = {
  src: string;
  alt: string;
  caption?: string;
};

type Props = {
  slides: LightboxSlide[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_PX = 56;
/** Закрытие свайпом вниз при scale≈1; только если вертикаль доминирует над горизонталью. */
const SWIPE_DOWN_CLOSE_PX = 96;

function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function ImageLightbox({
  slides,
  index,
  onClose,
  onIndexChange,
}: Props) {
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
  } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
  } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [overlayPullY, setOverlayPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [closingMode, setClosingMode] = useState<null | "fade" | "swipe">(null);
  const closeTimerRef = useRef<number | null>(null);
  const tapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const slide = slides[index];

  const requestClose = useCallback(
    (mode: "fade" | "swipe" = "fade") => {
      if (closingMode) return;
      setClosingMode(mode);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        onClose();
      }, 140);
    },
    [closingMode, onClose],
  );

  const resetTransform = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
    pinchRef.current = null;
    panRef.current = null;
    swipeStartRef.current = null;
  }, []);

  useEffect(() => {
    resetTransform();
  }, [index, resetTransform]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  /** Блокировка фона: overflow:hidden на iOS не хватает — фиксируем body. */
  useEffect(() => {
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      touchAction: body.style.touchAction,
    };
    const gap = window.innerWidth - html.clientWidth;
    if (gap > 0) {
      body.style.paddingRight = `${gap}px`;
    }
    html.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    return () => {
      /**
       * Важно для sticky-шапки: восстанавливаем скролл максимально «без кадра 0».
       * Иначе на части устройств заметна вспышка верхней панели при закрытии.
       */
      const prevInlineScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      // Предустановка целевой позиции до снятия fixed-блокировки.
      window.scrollTo(0, scrollY);
      html.style.overflow = prevHtmlOverflow;
      Object.assign(body.style, prevBody);
      body.style.paddingRight = "";
      body.style.touchAction = "";
      // Повторная синхронизация после снятия fixed + еще один кадр-запас.
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
      html.style.scrollBehavior = prevInlineScrollBehavior;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestClose("fade");
        return;
      }
      if (slides.length < 2) return;
      /* При зуме стрелки не листают — как горизонтальный свайп только при scale≈1 */
      if (scaleRef.current > 1.01) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange((index - 1 + slides.length) % slides.length);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onIndexChange((index + 1) % slides.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose, onIndexChange, slides.length, index]);

  const shareCurrentPhoto = useCallback(async () => {
    const src = slide?.src;
    if (!src || shareBusy) return;
    setShareBusy(true);
    setShareHint(null);
    try {
      if (typeof navigator.share === "function") {
        try {
          const res = await fetch(src, { mode: "cors" });
          const blob = await res.blob();
          const mime = blob.type || "image/jpeg";
          const ext = mime.includes("png")
            ? "png"
            : mime.includes("webp")
              ? "webp"
              : "jpg";
          const file = new File(
            [blob],
            `photo-${index + 1}.${ext}`,
            { type: mime },
          );
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: slide.alt || "Фото",
              text: slide.caption || undefined,
            });
            return;
          }
        } catch {
          /* файл недоступен (CORS и т.д.) — шарим URL */
        }
        await navigator.share({
          title: slide.alt || "Фото",
          text: slide.caption || slide.alt || "",
          url: src,
        });
        return;
      }
      await navigator.clipboard.writeText(src);
      setShareHint("Ссылка скопирована");
      window.setTimeout(() => setShareHint(null), 2500);
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(src);
          setShareHint("Ссылка скопирована");
          window.setTimeout(() => setShareHint(null), 2500);
        } catch {
          setShareHint("Не удалось поделиться");
          window.setTimeout(() => setShareHint(null), 2500);
        }
      }
    } finally {
      setShareBusy(false);
    }
  }, [index, shareBusy, slide]);

  /** Нативный non-passive touchmove: iOS иначе может тянуть страницу под оверлеем. */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
      else if (e.touches.length === 1 && scaleRef.current > 1.01) {
        e.preventDefault();
      } else if (
        e.touches.length === 1 &&
        scaleRef.current <= 1.01 &&
        swipeStartRef.current
      ) {
        const t = e.touches[0];
        const s = swipeStartRef.current;
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (dy > 12 && dy > Math.abs(dx)) e.preventDefault();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      swipeStartRef.current = null;
      setOverlayPullY(0);
      setIsPulling(false);
      panRef.current = null;
      pinchRef.current = {
        startDist: touchDistance(e.touches[0], e.touches[1]),
        startScale: scale,
      };
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      pinchRef.current = null;
      if (scale > 1.01) {
        panRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          originPanX: panX,
          originPanY: panY,
        };
        swipeStartRef.current = null;
        setOverlayPullY(0);
        setIsPulling(false);
      } else {
        panRef.current = null;
        swipeStartRef.current = { x: t.clientX, y: t.clientY };
        setOverlayPullY(0);
        setIsPulling(false);
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = touchDistance(e.touches[0], e.touches[1]);
      if (pinchRef.current.startDist < 1) return;
      const next = clamp(
        pinchRef.current.startScale * (d / pinchRef.current.startDist),
        MIN_SCALE,
        MAX_SCALE,
      );
      setScale(next);
      if (next <= 1.01) {
        setPanX(0);
        setPanY(0);
      }
      return;
    }
    if (e.touches.length === 1 && panRef.current && scale > 1.01) {
      e.preventDefault();
      const t = e.touches[0];
      setPanX(
        panRef.current.originPanX + (t.clientX - panRef.current.startX),
      );
      setPanY(
        panRef.current.originPanY + (t.clientY - panRef.current.startY),
      );
      return;
    }
    if (
      e.touches.length === 1 &&
      scaleRef.current <= 1.01 &&
      swipeStartRef.current
    ) {
      const t = e.touches[0];
      const s = swipeStartRef.current;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (dy > 12 && dy > Math.abs(dx)) {
        e.preventDefault();
        setIsPulling(true);
        setOverlayPullY(Math.min(dy, 360));
      } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
        setIsPulling(false);
        setOverlayPullY(0);
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length >= 1) {
      if (e.touches.length === 1 && pinchRef.current) {
        pinchRef.current = null;
      }
      return;
    }

    pinchRef.current = null;
    panRef.current = null;

    if (scaleRef.current <= 1.01) {
      setPanX(0);
      setPanY(0);
      if (scaleRef.current < 1) setScale(1);
    }

    const t = e.changedTouches[0];
    if (!t) {
      swipeStartRef.current = null;
      setOverlayPullY(0);
      return;
    }

    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    setIsPulling(false);

    if (start && scaleRef.current <= 1.01) {
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (dy > SWIPE_DOWN_CLOSE_PX && dy > Math.abs(dx)) {
        setOverlayPullY(Math.min(Math.max(dy, SWIPE_DOWN_CLOSE_PX), 420));
        requestClose("swipe");
        return;
      }
    }

    setOverlayPullY(0);

    const swipeOk = slides.length > 1 && scaleRef.current <= 1.01;
    if (swipeOk && start) {
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) > Math.abs(dy) && dx > SWIPE_PX) {
        onIndexChange((index - 1 + slides.length) % slides.length);
        return;
      }
      if (Math.abs(dx) > Math.abs(dy) && dx < -SWIPE_PX) {
        onIndexChange((index + 1) % slides.length);
        return;
      }
    }

    const now = Date.now();
    const prev = tapRef.current;
    tapRef.current = { t: now, x: t.clientX, y: t.clientY };
    if (
      prev &&
      now - prev.t < 280 &&
      Math.hypot(t.clientX - prev.x, t.clientY - prev.y) < 32
    ) {
      tapRef.current = null;
      if (scaleRef.current > 1.01) {
        resetTransform();
      } else {
        setScale(DOUBLE_TAP_SCALE);
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.008;
      setScale((s) => clamp(s + delta, MIN_SCALE, MAX_SCALE));
    }
  };

  if (
    typeof document === "undefined" ||
    slides.length === 0 ||
    index < 0 ||
    index >= slides.length ||
    !slide?.src
  ) {
    return null;
  }

  const overlayOpacity =
    overlayPullY > 0 ? Math.max(0.4, 1 - overlayPullY / 480) : 1;
  const pullTransition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
  const fadeTransition = "opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)";

  const ui = (
    <div
      className="fixed inset-0 z-[200] animate-in fade-in duration-200"
      style={{
        overscrollBehavior: "none",
        touchAction: "none",
        opacity: closingMode ? 0 : 1,
        transition: closingMode ? fadeTransition : undefined,
      }}
      onClick={() => requestClose("fade")}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-md"
        style={{
          opacity: overlayOpacity,
          willChange: "opacity",
          transition: isPulling ? "none" : fadeTransition,
        }}
      />
      <div
        className="relative z-[1] grid h-full grid-rows-[auto_minmax(0,1fr)]"
        style={{
          transform:
            closingMode === "swipe"
              ? `translate3d(0, ${Math.max(overlayPullY, 180)}px, 0)`
              : overlayPullY > 0
                ? `translate3d(0, ${overlayPullY}px, 0)`
                : undefined,
          willChange: "transform",
          transition: isPulling ? "none" : pullTransition,
        }}
      >
      {/* Панель сверху — не наезжает на фото; safe-area сверху здесь */}
      <div
        className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur-md sm:px-4 sm:py-3"
        style={{
          paddingTop: "max(0.625rem, env(safe-area-inset-top, 0px))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="relative flex w-1/3 min-w-0 justify-start">
          <button
            type="button"
            aria-label="Поделиться фотографией"
            disabled={shareBusy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[15px] font-medium text-white/90 shadow-sm backdrop-blur-md transition hover:bg-white/15 active:scale-90 disabled:opacity-50"
            onClick={() => void shareCurrentPhoto()}
          >
            <ShareForwardIcon size={20} className="text-white/90" />
          </button>
          {shareHint ? (
            <p className="absolute left-0 top-full z-10 mt-2 max-w-[min(100vw-2rem,16rem)] rounded-lg bg-black/70 px-2 py-1.5 text-[13px] leading-snug text-white/90 backdrop-blur-sm">
              {shareHint}
            </p>
          ) : null}
        </div>

        <div className="flex w-1/3 min-w-0 justify-center">
          {slides.length > 1 ? (
            <p
              className="flex min-h-9 items-center justify-center px-2 text-[15px] font-medium tabular-nums leading-none text-white/90"
              aria-live="polite"
            >
              {index + 1} / {slides.length}
            </p>
          ) : (
            <span className="inline-flex min-h-9 min-w-0 items-center" aria-hidden />
          )}
        </div>

        <div className="flex w-1/3 min-w-0 justify-end">
          <button
            type="button"
            className="flex min-h-9 items-center rounded-full px-3 text-[15px] font-medium leading-none text-white/90 transition hover:bg-white/10 active:bg-white/15"
            onClick={() => requestClose("fade")}
          >
            Закрыть
          </button>
        </div>
      </div>

      {/* Ячейка grid minmax(0,1fr): гарантированная высота под панелью; без лишнего overflow у корня ячейки */}
      <div
        ref={viewportRef}
        className="relative flex min-h-0 min-w-0 flex-col px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
        style={{ touchAction: "none" }}
        onClick={(ev) => ev.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute inset-0 min-h-0 min-w-0 overflow-hidden">
            <div
              className="flex h-full w-full min-h-0 min-w-0 items-center justify-center will-change-transform"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
                transformOrigin: "center center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.src}
                alt={slide.alt}
                className="h-full w-full select-none rounded-lg object-contain object-center shadow-2xl"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {slide.caption ? (
          <div
            className="shrink-0 px-2 pb-2 pt-1"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="mx-auto max-w-2xl rounded-2xl bg-black/40 p-3 text-center text-[15px] leading-relaxed text-white/90 backdrop-blur-md">
              {slide.caption}
            </p>
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
