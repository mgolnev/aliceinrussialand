"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, X } from "lucide-react";

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
  const tapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const slide = slides[index];

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
      html.style.overflow = prevHtmlOverflow;
      Object.assign(body.style, prevBody);
      body.style.paddingRight = "";
      body.style.touchAction = "";
      /* На всякий случай: инлайн smooth на html ломает мгновенный возврат скролла. */
      const prevInlineScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, scrollY);
      html.style.scrollBehavior = prevInlineScrollBehavior;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      } else {
        panRef.current = null;
        swipeStartRef.current = { x: t.clientX, y: t.clientY };
        setOverlayPullY(0);
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
        setOverlayPullY(Math.min(dy, 360));
      } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
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
    setOverlayPullY(0);

    if (start && scaleRef.current <= 1.01) {
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (dy > SWIPE_DOWN_CLOSE_PX && dy > Math.abs(dx)) {
        onClose();
        return;
      }
    }

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

  const ui = (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
      style={{
        overscrollBehavior: "none",
        touchAction: "none",
        transform: overlayPullY > 0 ? `translateY(${overlayPullY}px)` : undefined,
        opacity:
          overlayPullY > 0
            ? Math.max(0.4, 1 - overlayPullY / 480)
            : undefined,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute inset-x-0 top-0 z-20 border-b border-white/15 bg-black/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 rounded-full px-3 py-2.5 text-[15px] font-semibold text-white transition active:bg-white/15"
            onClick={onClose}
          >
            <X size={20} strokeWidth={2.25} aria-hidden />
            <span className="hidden sm:inline">Закрыть</span>
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 pt-14 pb-24"
        style={{ touchAction: "none" }}
        onClick={(ev) => ev.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        <div
          className="flex max-h-full max-w-full items-center justify-center will-change-transform"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.src}
            alt={slide.alt}
            className="max-h-[min(85dvh,85vh)] max-w-full select-none rounded-lg object-contain shadow-2xl"
            draggable={false}
          />
        </div>
      </div>

      {slide.caption ? (
        <div
          className="pointer-events-none absolute bottom-safe-offset-8 left-4 right-4 mx-auto max-w-2xl"
          onClick={(ev) => ev.stopPropagation()}
        >
          <p className="rounded-2xl bg-black/40 p-4 text-center text-[15px] leading-relaxed text-white/90 backdrop-blur-md">
            {slide.caption}
          </p>
        </div>
      ) : null}

      <div
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-30 flex flex-col items-start gap-1"
        onClick={(ev) => ev.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Поделиться фотографией"
          disabled={shareBusy}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
          onClick={() => void shareCurrentPhoto()}
        >
          <Share2 size={22} strokeWidth={2} aria-hidden />
        </button>
        {shareHint ? (
          <p className="max-w-[min(100vw-2rem,16rem)] rounded-lg bg-black/60 px-2 py-1.5 text-xs text-white/90 backdrop-blur-sm">
            {shareHint}
          </p>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div
          className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1.5 text-sm tabular-nums text-white/85 backdrop-blur-md"
          aria-live="polite"
        >
          {index + 1} / {slides.length}
        </div>
      ) : null}
    </div>
  );

  return createPortal(ui, document.body);
}
