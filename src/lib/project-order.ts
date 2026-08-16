export const PROJECT_ORDER_MODE = {
  NEWEST_FIRST: "NEWEST_FIRST",
  MANUAL: "MANUAL",
} as const;

export type ProjectOrderMode =
  (typeof PROJECT_ORDER_MODE)[keyof typeof PROJECT_ORDER_MODE];

export function projectOrderMode(value: unknown): ProjectOrderMode {
  return value === PROJECT_ORDER_MODE.MANUAL
    ? PROJECT_ORDER_MODE.MANUAL
    : PROJECT_ORDER_MODE.NEWEST_FIRST;
}

type DatedPost = {
  id: string;
  publishedAt: Date | string | null;
};

/** Стабильный порядок ленты: сначала новые, при равной дате — по id. */
export function comparePostsNewestFirst<T extends DatedPost>(a: T, b: T): number {
  const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : -Infinity;
  const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : -Infinity;
  return bTime - aTime || a.id.localeCompare(b.id);
}
