/** Элемент списка постов канала (превью t.me / парсер). */

export type TelegramFeedListItem = {
  messageId: string;
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
};

function tgItemTimeMs(it: TelegramFeedListItem): number | null {
  if (!it.dateIso) return null;
  const t = Date.parse(it.dateIso);
  return Number.isNaN(t) ? null : t;
}

function tgMessageNum(it: TelegramFeedListItem): number {
  const tail = it.messageId.includes("/")
    ? (it.messageId.split("/").pop() ?? it.messageId)
    : it.messageId;
  const n = parseInt(tail, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Витрина t.me отдаёт посты от старых к новым — в UI показываем новые сверху.
 */
export function sortTelegramItemsNewestFirst<T extends TelegramFeedListItem>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const ta = tgItemTimeMs(a);
    const tb = tgItemTimeMs(b);
    if (ta != null && tb != null && tb !== ta) return tb - ta;
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    return tgMessageNum(b) - tgMessageNum(a);
  });
}
