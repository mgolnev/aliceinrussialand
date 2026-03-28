"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string };
      setError(data?.error ?? "Ошибка входа");
      return;
    }
    const from = searchParams.get("from") || "/";
    router.replace(from);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-[32px] border border-stone-200/80 bg-white/92 p-8 shadow-[0_24px_70px_-44px_rgba(60,44,29,0.5)] backdrop-blur-sm">
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
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-stone-700">
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          disabled={loading}
          className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
        >
          {loading ? "Вход…" : "Войти"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-[32px] border border-stone-200 bg-white p-8 text-center text-sm text-stone-500 shadow-sm">
          Загрузка…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
