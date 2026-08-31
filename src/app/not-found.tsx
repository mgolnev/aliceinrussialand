import Link from "next/link";
import { getSiteSettings } from "@/lib/site";

export default async function NotFound() {
  const settings = await getSiteSettings();
  const homeDescription = settings.tagline.trim() || "вас очень ждут!";

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-6 py-8 text-center text-stone-900 sm:px-8 sm:py-12">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 280 176"
        className="mb-5 h-auto w-56 max-w-full text-stone-600 sm:mb-7 sm:w-64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g transform="rotate(-7 126 88)">
          <path d="M72 22 183 24 181 151 70 149Z" />
          <path d="m81 32 92 1-1 107-93-1Z" />
          <path d="m72 22 9 10m102-8-10 9m8 118-9-11m-102 9 9-10" />
          <path
            d="M99 117c-8-23 3-46 24-44 24 3 28 41 8 51-11 6-18-6-6-13 15-9 34-1 47 11"
            stroke="#a08059"
            strokeDasharray="2 6"
          />
        </g>
        <path d="m47 158 29-2m12 1 98 2m12 0 49-2" stroke="#d6cabe" />
        <circle cx="194" cy="138" r="7" fill="#faf6ef" />
        <path
          d="M218 151c-16 0-27-8-24-21 2-8 8-14 15-17-3-7-2-14 2-19-4-11-6-33 0-37 7-2 9 20 8 30 7-14 17-26 21-21 5 7-10 25-14 30 8 6 13 13 9 19-3 4-7 5-12 5 15 7 20 20 14 29Z"
          fill="#faf6ef"
        />
        <path d="M216 130c8-1 13 7 9 13m-8 7 17-1m-22-53 5 1" />
        <circle cx="225" cy="105" r="1.4" fill="currentColor" stroke="none" />
        <path d="m233 111 3 1m-14 2 5 1" />
      </svg>
      <p className="text-xs font-medium tracking-[0.16em] text-stone-500">
        404 · СТРАНИЦА НЕ НАЙДЕНА
      </p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-balance">
        Кажется, мы вышли за рамки
      </h1>
      <p className="mt-4 max-w-xs text-base leading-7 break-words text-stone-600 text-pretty">
        Здесь страницы нет. Зато на главной — {homeDescription}
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-stone-900 px-5 py-3 text-base font-medium text-white hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900 sm:w-auto sm:px-7"
      >
        Вернуться на главную
      </Link>
    </main>
  );
}
