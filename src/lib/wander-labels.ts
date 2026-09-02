/** Short invitations, not artwork judgements or promises of a different action. */
export const WANDER_NEXT_LABELS = [
  "нырнём", "погнали", "побредём", "полетели", "шагнём", "покатились",
  "поскачем", "поплыли", "пошуршим", "прошмыгнём", "потопаем", "покружим",
  "заглянем", "свернём", "проскочим", "забредём", "вынырнем", "прыгнем",
  "поползём", "прогуляемся",
  "шмыг", "прыг", "скок", "вжух", "шасть", "хоп", "опля", "тынц", "плюх", "бульк",
  "чик", "фьюить", "фыр", "тыр-пыр", "топ-топ", "тук-тук", "шур-шур", "прыг-скок",
  "ап!", "вуаля",
  "а вдруг", "а если", "почему бы нет", "ну допустим", "ну-ка", "а ну-ка",
  "что ж", "допустим", "проверим", "посмотрим", "интересно", "любопытно",
  "кто знает", "мало ли", "может быть", "пожалуй", "ну ладно", "ещё чуть-чуть",
  "не будем гадать", "так-так",
  "за угол", "по тропинке", "через двор", "за горизонт", "в зазеркалье", "в неизвестность",
  "на другую орбиту", "куда несёт", "куда глаза", "по следам", "между прочим", "мимоходом",
  "по касательной", "по диагонали", "поперёк", "наискосок", "в обход", "вперевалочку",
  "вприпрыжку", "на цыпочках",
  "что там", "а там?", "а потом?", "а вот ещё", "ну и ну", "ого-го", "хм", "ага",
  "ой", "ух ты", "о как", "надо же", "вот так", "вот это поворот", "ещё поворот",
  "сменим ракурс", "сменим воздух", "ловим момент", "идём на ощупь", "без маршрута",
  "за белым кроликом", "в кроличью нору", "через портал", "в другую сказку", "за облако",
  "за шорохом", "по крошкам", "по звёздам", "с попутным ветром", "по воле случая",
  "куда-то туда", "совсем вбок", "чуть за край", "на авось", "наудачу", "наобум",
  "без компаса", "отпустим руль", "лови случай", "а была не была",
] as const;

export type WanderNextLabel = typeof WANDER_NEXT_LABELS[number];
export type WanderLabelDeck = { remaining: WanderNextLabel[]; recent: WanderNextLabel[] };
export const WANDER_LABELS_STORAGE_KEY = "alice:wander:button-labels:v1";
export const WANDER_LABEL_RECENT_LIMIT = 40;
const labels = new Set<string>(WANDER_NEXT_LABELS);

export function isWanderNextLabel(value: unknown): value is WanderNextLabel {
  return typeof value === "string" && labels.has(value);
}

export function restoreWanderLabelDeck(raw: string | null): WanderLabelDeck | null {
  if (!raw || raw.length > 16_000) return null;
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Array.isArray(saved.remaining) || !Array.isArray(saved.recent)) return null;
    if (saved.remaining.length > WANDER_NEXT_LABELS.length || saved.recent.length > WANDER_LABEL_RECENT_LIMIT) return null;
    return {
      remaining: [...new Set<WanderNextLabel>(saved.remaining.filter(isWanderNextLabel))],
      recent: saved.recent.filter(isWanderNextLabel),
    };
  } catch {
    return null;
  }
}

/** Draw without replacement; protect the last 40 labels across cycle boundaries too. */
export function drawWanderLabel(deck: WanderLabelDeck, random = Math.random): {
  label: WanderNextLabel;
  deck: WanderLabelDeck;
} {
  const remaining = deck.remaining.length ? deck.remaining : [...WANDER_NEXT_LABELS];
  const recent = new Set(deck.recent);
  const fresh = remaining.filter((label) => !recent.has(label));
  // The fallback only matters for an inconsistent/edited storage record.
  const candidates = fresh.length ? fresh : remaining;
  const label = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]!;
  return {
    label,
    deck: {
      remaining: remaining.filter((item) => item !== label),
      recent: [...deck.recent, label].slice(-WANDER_LABEL_RECENT_LIMIT),
    },
  };
}
