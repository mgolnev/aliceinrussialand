/** Парсинг номера счётчика: допускаются только цифры (остальное отбрасывается). */
export function parseYandexCounterId(
  raw: string | undefined | null,
): number | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

/** Достижение цели (после загрузки tag.js на клиенте). */
export function ymReachGoal(
  rawId: string | undefined | null,
  goal: string,
  params?: Record<string, unknown>,
) {
  const id = parseYandexCounterId(rawId);
  if (id == null) return;
  if (typeof window === "undefined" || typeof window.ym !== "function") return;
  try {
    if (params && Object.keys(params).length > 0) {
      window.ym(id, "reachGoal", goal, params);
    } else {
      window.ym(id, "reachGoal", goal);
    }
  } catch {
    /* ignore */
  }
}
