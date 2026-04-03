/**
 * Детерминированный «случайный» порядок от строки-сидa (SSR-friendly, без Math.random).
 */

export function stringToSeed32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG [0, 1) от 32-битного сида. */
function mulberry32(initial: number) {
  let a = initial >>> 0;
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Копия массива в перемешанном порядке (Fisher–Yates). */
export function shuffleDeterministic<T>(items: readonly T[], seed: string): T[] {
  const arr = [...items];
  const rng = mulberry32(stringToSeed32(seed));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

/** Индекс в [0, length) от сида. */
export function indexFromSeed(seed: string, length: number): number {
  if (length <= 0) return 0;
  return stringToSeed32(seed) % length;
}
