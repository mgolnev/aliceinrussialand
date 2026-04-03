/**
 * Рекомендации: разнообразие по категориям без смены UI.
 * Глобальный порядок в `globallyOrdered` задаёт приоритет качества внутри каждой темы.
 */
export function diversifyByCategoryRoundRobin<T extends { id: string; categoryId: string | null }>(
  globallyOrdered: T[],
  limit: number,
): T[] {
  if (limit <= 0) return [];
  const buckets = new Map<string, T[]>();
  const catFirstIndex = new Map<string, number>();
  for (let i = 0; i < globallyOrdered.length; i++) {
    const p = globallyOrdered[i]!;
    const k = p.categoryId ?? "__uncat__";
    if (!catFirstIndex.has(k)) catFirstIndex.set(k, i);
    const b = buckets.get(k);
    if (b) b.push(p);
    else buckets.set(k, [p]);
  }
  const catOrder = [...catFirstIndex.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
  const out: T[] = [];
  while (out.length < limit) {
    let progressed = false;
    for (const k of catOrder) {
      const b = buckets.get(k);
      if (b?.length) {
        out.push(b.shift()!);
        progressed = true;
        if (out.length >= limit) break;
      }
    }
    if (!progressed) break;
  }
  return out;
}

/** Отрицательное значение — `a` выше в ленте, чем `b`. */
export function compareCarouselQuality(
  a: { pinned: boolean; publishedAt: Date | null; id: string },
  b: { pinned: boolean; publishedAt: Date | null; id: string },
): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const at = a.publishedAt?.getTime() ?? 0;
  const bt = b.publishedAt?.getTime() ?? 0;
  if (at !== bt) return bt - at;
  return b.id.localeCompare(a.id);
}
