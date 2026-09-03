const MAX_WANDER_CATEGORY_EXCLUSIONS = 500;
const MAX_CATEGORY_ID_LENGTH = 100;

export const DEFAULT_WANDER_ENTRY_LABEL = "не жми сюда";
export const WANDER_ENTRY_LABEL_MAX_LENGTH = 60;
export const DEFAULT_WANDER_ENTRY_SUBTITLE = "серьёзно. неизвестно, куда попадёшь";
export const WANDER_ENTRY_SUBTITLE_MAX_LENGTH = 160;
export const DEFAULT_WANDER_IMAGE_COUNT = 7;
export const WANDER_IMAGE_COUNT_MIN = 1;
export const WANDER_IMAGE_COUNT_MAX = 100;

export function normalizeWanderImageCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value)
    && value >= WANDER_IMAGE_COUNT_MIN && value <= WANDER_IMAGE_COUNT_MAX
    ? value : null;
}

export function normalizeWanderEntryLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  if (!label || label.length > WANDER_ENTRY_LABEL_MAX_LENGTH) return null;
  return label;
}

export function normalizeWanderEntrySubtitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const subtitle = value.trim();
  if (!subtitle || subtitle.length > WANDER_ENTRY_SUBTITLE_MAX_LENGTH) return null;
  return subtitle;
}

export function normalizeWanderExcludedCategoryIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_WANDER_CATEGORY_EXCLUSIONS) return null;

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return null;
    const id = item.trim();
    if (!id || id.length > MAX_CATEGORY_ID_LENGTH) return null;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
