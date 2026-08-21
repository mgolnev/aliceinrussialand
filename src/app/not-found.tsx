import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-5 py-12 text-stone-900">
      <p className="text-sm font-medium text-stone-500">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-stone-600">
        Возможно, адрес изменился или публикация больше не доступна.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex w-fit rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white"
      >
        Вернуться в ленту
      </Link>
    </main>
  );
}
