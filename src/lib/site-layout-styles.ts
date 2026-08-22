/** Единая горизонтальная сетка публичной шапки, контента и подвала. */
export const siteFrameClass =
  "mx-auto w-full min-w-0 max-w-3xl px-3 sm:px-5";

/** Вертикальный ритм публичных страниц внутри общей сетки. */
export function siteContentClass(
  density: "feed" | "compact" = "feed",
): string {
  return [
    siteFrameClass,
    "py-4",
    density === "feed" ? "sm:py-10" : "sm:py-8",
  ].join(" ");
}
