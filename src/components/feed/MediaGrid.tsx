"use client";

type GridImage = {
  id: string;
  src?: string;
  alt: string;
};

type Props = {
  images: GridImage[];
  onImageClick?: (index: number) => void;
};

function itemClass(index: number, count: number) {
  if (count === 1) return "col-span-6";
  if (count === 2) return "col-span-3";
  if (count === 3) {
    return index === 0 ? "col-span-3 row-span-2" : "col-span-3";
  }
  if (count === 4) return "col-span-3";
  if (count >= 5) {
    if (index < 2) return "col-span-3";
    return "col-span-2";
  }
  return "col-span-3";
}

function aspectClass(index: number, count: number) {
  if (count === 1) return "aspect-[4/3]";
  if (count === 2) return "aspect-square";
  if (count === 3) return index === 0 ? "aspect-[4/5] h-full" : "aspect-[4/3]";
  if (count === 4) return "aspect-square";
  return index < 2 ? "aspect-[4/3]" : "aspect-square";
}

export function MediaGrid({ images, onImageClick }: Props) {
  const visible = images.slice(0, 5);
  const extra = Math.max(images.length - visible.length, 0);

  return (
    <div className="grid grid-cols-6 gap-2">
      {visible.map((image, index) => {
        const clickable = typeof onImageClick === "function";
        const className = `relative overflow-hidden rounded-[22px] border border-stone-200 bg-stone-50 text-left shadow-sm ${itemClass(
          index,
          visible.length,
        )}`;
        const content = (
          <>
            {image.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.src}
                alt={image.alt}
                className={`w-full object-cover ${aspectClass(index, visible.length)}`}
              />
            ) : (
              <div
                className={`w-full bg-stone-100 ${aspectClass(index, visible.length)}`}
              />
            )}
            {extra > 0 && index === visible.length - 1 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-xl font-semibold text-white">
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
}
