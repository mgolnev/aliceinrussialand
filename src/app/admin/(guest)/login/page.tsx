type SearchParams = Promise<{ from?: string; error?: string }>;

function safeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const from = safeReturnPath(params.from);
  const error =
    params.error === "invalid_password"
      ? "Неверный пароль"
      : params.error === "server_error"
        ? "Не удалось выполнить вход. Проверьте настройки сервера."
        : null;

  return (
    <div className="w-full max-w-md rounded-[32px] border border-stone-200/80 bg-white/92 p-8 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-sm font-semibold text-white">
          AR
        </div>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Вход в админку</h1>
          <p className="mt-1 text-sm text-stone-500">
            Только для автора сайта
          </p>
        </div>
      </div>
      <p className="text-sm leading-6 text-stone-600">
        Здесь можно быстро публиковать новые работы, импортировать посты из
        Telegram и настраивать сайт.
      </p>
      <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
        <input type="hidden" name="from" value={from} />
        <label className="block text-sm font-medium text-stone-700">
          Пароль
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-2xl border border-stone-300 px-4 py-3 text-stone-900 outline-none ring-stone-300 focus:ring-2"
          />
        </label>
        {error ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          Войти
        </button>
      </form>
    </div>
  );
}
