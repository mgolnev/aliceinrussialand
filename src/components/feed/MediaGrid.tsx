"use client";

type GridImage = {
  id: string;
  src?: string;
  alt: string;
};

type Props = {
  images: GridImage[];
  onImageClick?: (index: number) => void;
  /** Компенсировать горизонтальный padding родителя — плитка на всю ширину */
  fullBleed?: boolean;
  /** Прямой низ без скругления — карточка поста с overflow-hidden обрезает углы */
  flushCardBottom?: boolean;
};

/** col-span / позиция в сетке 6 колонок */
function itemClass(index: number, count: number) {
  if (count === 1) return "col-span-6";
  if (count === 2) return "col-span-3";
  if (count === 3) {
    return index === 0 ? "col-span-3 row-span-2" : "col-span-3";
  }
  if (count === 4) return "col-span-3";
  if (count >= 5) {
    switch (index) {
      case 0:
        return "col-span-3 col-start-1 row-start-1";
      case 1:
        return "col-span-3 col-start-4 row-start-1";
      case 2:
        return "col-span-6 col-start-1 row-start-2";
      case 3:
        return "col-span-3 col-start-1 row-start-3";
      case 4:
        return "col-span-3 col-start-4 row-start-3";
      default:
        return "col-span-2";
    }
  }
  return "col-span-3";
}

function aspectClass(index: number, count: number) {
  if (count === 1) return "aspect-[5/4] min-h-[200px] sm:aspect-[16/10] sm:min-h-0";
  if (count === 2) return "aspect-[4/3] min-h-[160px] sm:aspect-[1/1] sm:min-h-0";
  if (count === 3) {
    return index === 0
      ? "aspect-[3/4] min-h-[220px] sm:min-h-0 sm:aspect-[4/5]"
      : "aspect-[4/3] min-h-[140px] sm:min-h-0";
  }
  if (count === 4) return "aspect-[4/3] min-h-[140px] sm:aspect-square sm:min-h-0";
  if (count >= 5) {
    if (index === 2) return "aspect-[5/3] min-h-[160px] sm:aspect-[2/1] sm:min-h-[200px]";
    if (index < 2) return "aspect-[4/3] min-h-[150px] sm:aspect-square sm:min-h-0";
    return "aspect-[4/3] min-h-[150px] sm:aspect-square sm:min-h-0";
  }
  return "aspect-[4/3]";
}

export function MediaGrid({
  images,
  onImageClick,
  fullBleed = false,
  flushCardBottom = false,
}: Props) {
  const visible = images.slice(0, 5);
  const extra = Math.max(images.length - visible.length, 0);
  const count = visible.length;

  const grid = (
    <div
      className="grid w-full min-w-0 grid-cols-6 gap-px bg-stone-200/90"
    >
      {visible.map((image, index) => {
        const clickable = typeof onImageClick === "function";
        const className = `relative min-w-0 overflow-hidden bg-stone-100 text-left ${itemClass(
          index,
          count,
        )}`;
        const content = (
          <>
            {image.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.src}
                alt={image.alt}
                className={`w-full min-w-0 object-cover ${aspectClass(index, count)}`}
              />
            ) : (
              <div
                className={`w-full bg-stone-200 ${aspectClass(index, count)}`}
              />
            )}
            {extra > 0 && index === visible.length - 1 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-lg font-semibold text-white sm:text-xl">
                +{extra}
              </div>
            ) : null}
          </>
        );

        if (clickable) {
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => onImageClick(index)}
              className={className}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={image.id} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );

  const frameClass =
    fullBleed && flushCardBottom
      ? "overflow-hidden rounded-b-none rounded-t-[10px] ring-1 ring-black/[0.06] sm:rounded-t-xl"
      : "overflow-hidden rounded-[10px] ring-1 ring-black/[0.06] sm:rounded-xl";

  const framed = <div className={frameClass}>{grid}</div>;

  if (!fullBleed) {
    return framed;
  }

  /* padding родителя: px-3 sm:px-5 (карточка поста / композер) */
  const bleedOuter =
    "-mx-3 w-[calc(100%+1.5rem)] min-w-0 sm:-mx-5 sm:w-[calc(100%+2.5rem)]";

  return <div className={bleedOuter}>{framed}</div>;
}
