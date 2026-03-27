"use client";

import type { CSSProperties, ReactNode } from "react";

export type GridImage = {
  id: string;
  src?: string;
  alt: string;
  width?: number | null;
  height?: number | null;
};

type Props = {
  images: GridImage[];
  onImageClick?: (index: number) => void;
  layoutSeed?: string;
  fullBleed?: boolean;
  flushCardBottom?: boolean;
};

type Ori = "portrait" | "landscape" | "square";

function orientation(w: number | null | undefined, h: number | null | undefined): Ori {
  if (w == null || h == null || w <= 0 || h <= 0) return "square";
  const r = w / h;
  if (r > 1.06) return "landscape";
  if (r < 0.94) return "portrait";
  return "square";
}

function hashSeed(seed: string | undefined): number {
  if (!seed) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Высота ряда: одинаковая для всех ячеек в ряду (как в Telegram). */
function aspectForRow(indices: number[], images: GridImage[]): string {
  const os = indices.map((i) =>
    orientation(images[i]?.width, images[i]?.height),
  );
  const p = os.filter((x) => x === "portrait").length;
  const l = os.filter((x) => x === "landscape").length;
  const n = indices.length;

  if (n === 1) {
    const o = os[0];
    if (o === "landscape") return "aspect-[16/10] sm:aspect-[16/9]";
    if (o === "portrait") return "aspect-[4/5] sm:aspect-[3/4]";
    return "aspect-[4/3]";
  }
  if (n === 2) {
    if (l === 2) return "aspect-[2/1] sm:aspect-[16/9]";
    if (p === 2) return "aspect-[5/4] sm:aspect-[6/5]";
    return "aspect-[15/9] sm:aspect-[16/10]";
  }
  if (n === 3) {
    if (l >= 2) return "aspect-[8/3] sm:aspect-[3/1]";
    if (p >= 2) return "aspect-[5/3] sm:aspect-[2/1]";
    return "aspect-[5/3]";
  }
  if (n === 4) return "aspect-[2/1] sm:aspect-[16/9]";
  return "aspect-[5/3]";
}

/** Пропорции ширин в ряду из 2 фото с учётом ориентации (~40/60 для портрет+ландшафт). */
function flexPairForTwo(
  images: GridImage[],
  i0: number,
  i1: number,
): [number, number] {
  const o0 = orientation(images[i0]?.width, images[i0]?.height);
  const o1 = orientation(images[i1]?.width, images[i1]?.height);
  if (o0 === "portrait" && o1 === "landscape") return [2, 3];
  if (o0 === "landscape" && o1 === "portrait") return [3, 2];
  return [1, 1];
}

/** Случайные «журнальные» пропорции для ряда из 2 (как в примерах 40/60, 50/50). */
function flexPairStaggered(
  images: GridImage[],
  i0: number,
  i1: number,
  rowIndex: number,
  seed: string | undefined,
): [number, number] {
  const base = flexPairForTwo(images, i0, i1);
  if (base[0] !== base[1]) return base;
  const h = hashSeed(seed) + rowIndex * 31;
  const patterns: [number, number][] = [
    [1, 1],
    [2, 3],
    [3, 2],
    [3, 5],
    [5, 3],
  ];
  return patterns[h % patterns.length] ?? [1, 1];
}

function rowSizesTelegram(n: number, seed: string | undefined): number[] {
  if (n <= 3) return [n];
  if (n === 4) return [2, 2];
  if (n === 5) return [2, 1, 2];
  if (n === 6) {
    return hashSeed(seed) % 2 === 0 ? [1, 2, 3] : [2, 2, 2];
  }
  if (n === 7) return [3, 2, 2];
  if (n === 8) return [4, 4];
  if (n === 9) return [3, 3, 3];
  if (n === 10) return [3, 3, 2, 2];
  const rows: number[] = [];
  let left = n;
  while (left > 4) {
    rows.push(3);
    left -= 3;
  }
  if (left === 4) {
    rows.push(2, 2);
  } else if (left === 3) {
    rows.push(3);
  } else if (left === 2) {
    rows.push(2);
  } else if (left === 1) {
    rows.push(1);
  }
  return rows;
}

type Layout =
  | { kind: "rows"; rows: { indices: number[]; flex: number[] }[] }
  | { kind: "grid4"; indices: [number, number, number, number] };

function buildLayout(images: GridImage[], seed: string | undefined): Layout {
  const n = images.length;
  if (n === 4) {
    return { kind: "grid4", indices: [0, 1, 2, 3] };
  }

  if (n === 5) {
    if (hashSeed(seed) % 2 === 0) {
      return {
        kind: "rows",
        rows: [
          { indices: [0, 1], flex: [...flexPairForTwo(images, 0, 1)] },
          { indices: [2, 3, 4], flex: [1, 1, 1] },
        ],
      };
    }
    return {
      kind: "rows",
      rows: [
        { indices: [0, 1], flex: [...flexPairForTwo(images, 0, 1)] },
        { indices: [2], flex: [1] },
        { indices: [3, 4], flex: [...flexPairForTwo(images, 3, 4)] },
      ],
    };
  }

  if (n === 6 && hashSeed(seed) % 2 === 0) {
    return {
      kind: "rows",
      rows: [
        { indices: [0], flex: [1] },
        { indices: [1, 2], flex: [1, 1] },
        { indices: [3, 4, 5], flex: [1, 1, 1] },
      ],
    };
  }

  if (n <= 6) {
    const rows: { indices: number[]; flex: number[] }[] = [];
    if (n === 1) rows.push({ indices: [0], flex: [1] });
    else if (n === 2) {
      rows.push({
        indices: [0, 1],
        flex: [...flexPairForTwo(images, 0, 1)],
      });
    } else if (n === 3) {
      rows.push({ indices: [0, 1, 2], flex: [1, 1, 1] });
    } else if (n === 6) {
      rows.push(
        { indices: [0, 1], flex: [...flexPairStaggered(images, 0, 1, 0, seed)] },
        { indices: [2, 3], flex: [...flexPairStaggered(images, 2, 3, 1, seed)] },
        { indices: [4, 5], flex: [...flexPairStaggered(images, 4, 5, 2, seed)] },
      );
    }
    return { kind: "rows", rows };
  }

  const sizes = rowSizesTelegram(n, seed);
  const rows: { indices: number[]; flex: number[] }[] = [];
  let start = 0;
  sizes.forEach((sz, rowIdx) => {
    const indices = Array.from({ length: sz }, (_, k) => start + k);
    start += sz;
    const flex =
      sz === 2
        ? [...flexPairStaggered(images, indices[0], indices[1], rowIdx, seed)]
        : indices.map(() => 1);
    rows.push({ indices, flex });
  });
  return { kind: "rows", rows };
}

function renderImageFill(
  image: GridImage,
  globalIndex: number,
  clickable: boolean,
  onImageClick?: (i: number) => void,
) {
  const inner = image.src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      alt={image.alt}
      loading={globalIndex > 5 ? "lazy" : "eager"}
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : (
    <div className="absolute inset-0 bg-stone-200" />
  );

  const shell = "relative block h-full min-h-0 min-w-0 overflow-hidden bg-stone-100";

  if (clickable && onImageClick) {
    return (
      <button
        key={image.id}
        type="button"
        className={`${shell} cursor-pointer border-0 p-0 text-left`}
        onClick={() => onImageClick(globalIndex)}
      >
        {inner}
      </button>
    );
  }

  return (
    <div key={image.id} className={shell}>
      {inner}
    </div>
  );
}

export function MediaGrid({
  images,
  onImageClick,
  layoutSeed,
  fullBleed = false,
  flushCardBottom = false,
}: Props) {
  const count = images.length;
  if (count === 0) return null;

  const clickable = typeof onImageClick === "function";
  const layout = buildLayout(images, layoutSeed);

  const frameClass =
    fullBleed && flushCardBottom
      ? "overflow-hidden rounded-b-none rounded-t-[10px] ring-1 ring-black/[0.06] sm:rounded-t-xl"
      : "overflow-hidden rounded-[10px] ring-1 ring-black/[0.06] sm:rounded-xl";

  const bleedOuter =
    "-mx-3 w-[calc(100%+1.5rem)] min-w-0 sm:-mx-5 sm:w-[calc(100%+2.5rem)]";

  let body: ReactNode;

  if (layout.kind === "grid4") {
    const [a, b, c, d] = layout.indices;
    body = (
      <div
        className="grid w-full min-w-0 gap-px bg-stone-200/90 [aspect-ratio:3/4] sm:[aspect-ratio:4/5]"
        style={
          {
            gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)",
            gridTemplateRows: "repeat(3, minmax(0, 1fr))",
          } as CSSProperties
        }
      >
        <div className="relative row-span-3 min-h-0 min-w-0">
          {renderImageFill(images[a], a, clickable, onImageClick)}
        </div>
        <div className="relative min-h-0 min-w-0">
          {renderImageFill(images[b], b, clickable, onImageClick)}
        </div>
        <div className="relative min-h-0 min-w-0">
          {renderImageFill(images[c], c, clickable, onImageClick)}
        </div>
        <div className="relative min-h-0 min-w-0">
          {renderImageFill(images[d], d, clickable, onImageClick)}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex w-full min-w-0 flex-col gap-px bg-stone-200/90">
        {layout.rows.map((row, ri) => {
          const aspect = aspectForRow(row.indices, images);
          return (
            <div
              key={ri}
              className={`flex w-full min-h-0 gap-px ${aspect}`}
            >
              {row.indices.map((imgIdx, ci) => {
                const flexGrow = row.flex[ci] ?? 1;
                return (
                  <div
                    key={images[imgIdx].id}
                    className="min-h-0 min-w-0"
                    style={{ flex: `${flexGrow} 1 0%` }}
                  >
                    {renderImageFill(
                      images[imgIdx],
                      imgIdx,
                      clickable,
                      onImageClick,
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  const framed = <div className={frameClass}>{body}</div>;

  if (!fullBleed) {
    return framed;
  }

  return <div className={bleedOuter}>{framed}</div>;
}
