"use client";

import type { CSSProperties, ReactNode } from "react";

type GridImage = {
  id: string;
  src?: string;
  alt: string;
};

type Props = {
  images: GridImage[];
  onImageClick?: (index: number) => void;
  /** Стабильный id поста — выбирает вариант плитки при одинаковом числе фото */
  layoutSeed?: string;
  /** Компенсировать горизонтальный padding родителя — плитка на всю ширину */
  fullBleed?: boolean;
  /** Прямой низ без скругления — карточка поста с overflow-hidden обрезает углы */
  flushCardBottom?: boolean;
};

/** Ячейка в сетке 12 колонок (grid-column / grid-row — 1-based start + span). */
type Cell = {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
  aspect: string;
};

function hashSeed(seed: string | undefined): number {
  if (!seed) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickVariant(seed: string | undefined, variantCount: number): number {
  if (variantCount <= 1) return 0;
  return hashSeed(seed) % variantCount;
}

/** Раскладки 1–6 фото: несколько вариантов на каждое число. */
const LAYOUTS: Record<number, Cell[][]> = {
  1: [
    [
      {
        col: 1,
        colSpan: 12,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[5/4] min-h-[200px] sm:aspect-[16/10] sm:min-h-0",
      },
    ],
  ],
  2: [
    [
      {
        col: 1,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[160px] sm:aspect-[1/1] sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[160px] sm:aspect-[1/1] sm:min-h-0",
      },
    ],
    [
      {
        col: 1,
        colSpan: 7,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[160px] sm:aspect-[4/5] sm:min-h-0",
      },
      {
        col: 8,
        colSpan: 5,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[160px] sm:aspect-[4/5] sm:min-h-0",
      },
    ],
    [
      {
        col: 1,
        colSpan: 5,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[160px] sm:aspect-[4/5] sm:min-h-0",
      },
      {
        col: 6,
        colSpan: 7,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[160px] sm:aspect-[4/5] sm:min-h-0",
      },
    ],
  ],
  3: [
    [
      {
        col: 1,
        colSpan: 6,
        row: 1,
        rowSpan: 2,
        aspect: "min-h-[220px] sm:min-h-0 sm:aspect-[4/5]",
      },
      {
        col: 7,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:min-h-0",
      },
    ],
    [
      {
        col: 1,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
      {
        col: 5,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
      {
        col: 9,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
    ],
    [
      {
        col: 1,
        colSpan: 12,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[16/9] min-h-[180px] sm:min-h-0",
      },
      {
        col: 1,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:min-h-0",
      },
    ],
  ],
  4: [
    [
      {
        col: 1,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:aspect-square sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:aspect-square sm:min-h-0",
      },
      {
        col: 1,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:aspect-square sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:aspect-square sm:min-h-0",
      },
    ],
    [
      {
        col: 1,
        colSpan: 8,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[16/10] min-h-[160px] sm:min-h-0",
      },
      {
        col: 9,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/5] min-h-[160px] sm:min-h-0",
      },
      {
        col: 1,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[140px] sm:min-h-0",
      },
    ],
  ],
  5: [
    [
      {
        col: 1,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:aspect-square sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:aspect-square sm:min-h-0",
      },
      {
        col: 1,
        colSpan: 12,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[2/1] min-h-[160px] sm:aspect-[21/9] sm:min-h-[200px]",
      },
      {
        col: 1,
        colSpan: 6,
        row: 3,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:aspect-square sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 3,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:aspect-square sm:min-h-0",
      },
    ],
    [
      {
        col: 1,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[130px] sm:min-h-0",
      },
      {
        col: 5,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[130px] sm:min-h-0",
      },
      {
        col: 9,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[130px] sm:min-h-0",
      },
      {
        col: 1,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:min-h-0",
      },
    ],
  ],
  6: [
    [
      {
        col: 1,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
      {
        col: 5,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
      {
        col: 9,
        colSpan: 4,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
      {
        col: 1,
        colSpan: 4,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
      {
        col: 5,
        colSpan: 4,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
      {
        col: 9,
        colSpan: 4,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-square min-h-[120px] sm:min-h-0",
      },
    ],
    [
      {
        col: 1,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 1,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:min-h-0",
      },
      {
        col: 1,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 2,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:min-h-0",
      },
      {
        col: 1,
        colSpan: 6,
        row: 3,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:min-h-0",
      },
      {
        col: 7,
        colSpan: 6,
        row: 3,
        rowSpan: 1,
        aspect: "aspect-[4/3] min-h-[150px] sm:min-h-0",
      },
    ],
  ],
};

function cellsForCount(count: number, seed: string | undefined): Cell[] {
  const table = LAYOUTS[count];
  if (!table?.length) {
    return [];
  }
  const v = pickVariant(seed, table.length);
  return table[v] ?? table[0];
}

/** Для 7+ фото — равномерная сетка; плотность колонок чуть меняется от seed. */
function manyColsClass(seed: string | undefined): string {
  const h = hashSeed(seed);
  const modes = [
    "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
    "grid-cols-2 sm:grid-cols-4",
    "grid-cols-3 sm:grid-cols-3 lg:grid-cols-4",
  ];
  return modes[h % modes.length] ?? modes[0];
}

function manyAspectClass(seed: string | undefined, index: number): string {
  const h = (hashSeed(seed) + index * 17) >>> 0;
  const aspects = [
    "aspect-square",
    "aspect-[4/5]",
    "aspect-[5/4]",
    "aspect-[1/1]",
  ];
  return aspects[h % aspects.length] ?? "aspect-square";
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

  const frameClass =
    fullBleed && flushCardBottom
      ? "overflow-hidden rounded-b-none rounded-t-[10px] ring-1 ring-black/[0.06] sm:rounded-t-xl"
      : "overflow-hidden rounded-[10px] ring-1 ring-black/[0.06] sm:rounded-xl";

  const bleedOuter =
    "-mx-3 w-[calc(100%+1.5rem)] min-w-0 sm:-mx-5 sm:w-[calc(100%+2.5rem)]";

  const renderCell = (
    image: GridImage,
    index: number,
    cellClass: string,
    style: CSSProperties,
  ) => {
    const inner = (
      <>
        {image.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.src}
            alt={image.alt}
            loading={index > 4 ? "lazy" : "eager"}
            decoding="async"
            className={`w-full min-w-0 object-cover ${cellClass}`}
          />
        ) : (
          <div className={`w-full bg-stone-200 ${cellClass}`} />
        )}
      </>
    );

    const wrapperClass =
      "relative min-w-0 overflow-hidden bg-stone-100 text-left";

    if (clickable) {
      return (
        <button
          key={image.id}
          type="button"
          onClick={() => onImageClick(index)}
          className={wrapperClass}
          style={style}
        >
          {inner}
        </button>
      );
    }

    return (
      <div key={image.id} className={wrapperClass} style={style}>
        {inner}
      </div>
    );
  };

  let grid: ReactNode;

  if (count >= 7) {
    const cols = manyColsClass(layoutSeed);
    grid = (
      <div className={`grid w-full min-w-0 gap-px bg-stone-200/90 ${cols}`}>
        {images.map((image, index) =>
          renderCell(
            image,
            index,
            `${manyAspectClass(layoutSeed, index)} min-h-[100px] sm:min-h-0`,
            {},
          ),
        )}
      </div>
    );
  } else {
    const specs = cellsForCount(count, layoutSeed);
    grid = (
      <div className="grid w-full min-w-0 auto-rows-auto grid-cols-12 gap-px bg-stone-200/90">
        {images.map((image, index) => {
          const spec = specs[index];
          if (!spec) {
            return renderCell(
              image,
              index,
              "aspect-square min-h-[120px] sm:min-h-0 col-span-6",
              {},
            );
          }
          return renderCell(image, index, spec.aspect, {
            gridColumn: `${spec.col} / span ${spec.colSpan}`,
            gridRow: `${spec.row} / span ${spec.rowSpan}`,
          });
        })}
      </div>
    );
  }

  const framed = <div className={frameClass}>{grid}</div>;

  if (!fullBleed) {
    return framed;
  }

  return <div className={bleedOuter}>{framed}</div>;
}
