/** Выбор URL пресета для отображения (без знания реальной ширины viewport на SSR). */
export function pickDefaultVariantUrl(
  variants: Record<string, string | undefined>,
): string | null {
  return (
    variants.w960 ?? variants.w640 ?? variants.w1280 ?? variants.w512 ?? null
  );
}

/** Для тестов: выбор по «логической» ширине макета (не тот же алгоритм, что у loader). */
export function pickVariantUrlForWidth(
  variants: Record<string, string | undefined>,
  cssWidthPx: number,
): string | null {
  const w640 = variants.w640;
  const w960 = variants.w960;
  const w1280 = variants.w1280;
  if (cssWidthPx <= 720) return w640 ?? w960 ?? w1280 ?? null;
  if (cssWidthPx <= 1100) return w960 ?? w1280 ?? w640 ?? null;
  return w1280 ?? w960 ?? w640 ?? null;
}

const PRESET_ORDER = [640, 960, 1280] as const;

/**
 * Для `next/image` loader: `width` — запрошенный размер (из `sizes` + deviceSizes).
 * Берём наименьший пресет, чья номинальная ширина ≥ запроса; иначе максимум из доступных.
 */
export function pickVariantUrlForRequestedWidth(
  variants: Record<string, string | undefined>,
  requestedWidth: number,
): string | null {
  const rw = Math.max(1, Math.ceil(requestedWidth));
  for (const size of PRESET_ORDER) {
    const url = variants[`w${size}`];
    if (url && size >= rw) return url;
  }
  return variants.w1280 ?? variants.w960 ?? variants.w640 ?? null;
}

export function intrinsicSizeForImage(
  width: number | null | undefined,
  height: number | null | undefined,
  fallbackRatio = 4 / 3,
): { width: number; height: number } {
  const w = width && width > 0 ? width : 1200;
  const h =
    height && height > 0 ? height : Math.max(1, Math.round(w / fallbackRatio));
  return { width: w, height: h };
}
