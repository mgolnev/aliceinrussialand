"use client";

import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { SocialLink } from "@/lib/site";

type Props = {
  initial: {
    displayName: string;
    tagline: string;
    bio: string;
    aboutMarkdown: string;
    telegramChannelUser: string;
    contactsLabel: string;
    siteUrl: string;
    plausibleDomain: string;
    yandexMetrikaId: string;
    defaultLocale: string;
    social: SocialLink[];
    avatarPreviewUrl: string | null;
    aboutPhotoPreviewUrl: string | null;
  };
};

export function SettingsForm({ initial }: Props) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(
    initial.avatarPreviewUrl,
  );
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [aboutPhotoUrl, setAboutPhotoUrl] = useState(
    initial.aboutPhotoPreviewUrl,
  );
  const [aboutPhotoBusy, setAboutPhotoBusy] = useState(false);
  const [aboutPhotoError, setAboutPhotoError] = useState<string | null>(null);
  const aboutPhotoInputRef = useRef<HTMLInputElement>(null);

  async function save() {
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName,
        tagline: form.tagline,
        bio: form.bio,
        aboutMarkdown: form.aboutMarkdown,
        telegramChannelUser: form.telegramChannelUser,
        contactsLabel: form.contactsLabel,
        siteUrl: form.siteUrl,
        plausibleDomain: form.plausibleDomain,
        yandexMetrikaId: form.yandexMetrikaId,
        defaultLocale: form.defaultLocale,
        socialLinksJson: JSON.stringify(form.social),
      }),
    });
    if (!res.ok) {
      setMessage("Не удалось сохранить");
      return;
    }
    setMessage("Сохранено");
  }

  function updateSocial(id: string, patch: Partial<SocialLink>) {
    setForm((f) => ({
      ...f,
      social: f.social.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function addSocial() {
    setForm((f) => ({
      ...f,
      social: [
        ...f.social,
        {
          id: nanoid(),
          label: "Новая ссылка",
          url: "https://",
          kind: "other",
        },
      ],
    }));
  }

  function removeSocial(id: string) {
    setForm((f) => ({ ...f, social: f.social.filter((s) => s.id !== id) }));
  }

  async function uploadAvatar(file: File) {
    setAvatarError(null);
    setAvatarBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/avatar", { method: "POST", body: fd });
    setAvatarBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setAvatarError(j?.error ?? "Не удалось загрузить");
      return;
    }
    const data = (await res.json()) as { previewUrl?: string };
    if (data.previewUrl) setAvatarPreviewUrl(data.previewUrl);
    setMessage("Аватар обновлён");
  }

  async function removeAvatar() {
    setAvatarError(null);
    setAvatarBusy(true);
    const res = await fetch("/api/admin/avatar", { method: "DELETE" });
    setAvatarBusy(false);
    if (!res.ok) {
      setAvatarError("Не удалось удалить");
      return;
    }
    setAvatarPreviewUrl(null);
    setMessage("Аватар удалён");
  }

  async function uploadAboutPhoto(file: File) {
    setAboutPhotoError(null);
    setAboutPhotoBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/about-photo", {
      method: "POST",
      body: fd,
    });
    setAboutPhotoBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setAboutPhotoError(j?.error ?? "Не удалось загрузить");
      return;
    }
    const data = (await res.json()) as { previewUrl?: string };
    if (data.previewUrl) setAboutPhotoUrl(data.previewUrl);
    setMessage("Фото «Обо мне» обновлено");
  }

  async function removeAboutPhoto() {
    setAboutPhotoError(null);
    setAboutPhotoBusy(true);
    const res = await fetch("/api/admin/about-photo", { method: "DELETE" });
    setAboutPhotoBusy(false);
    if (!res.ok) {
      setAboutPhotoError("Не удалось удалить");
      return;
    }
    setAboutPhotoUrl(null);
    setMessage("Фото «Обо мне» удалено");
  }

  return (
    <div className="space-y-6 rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
      <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          {avatarPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreviewUrl}
              alt=""
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-full object-cover shadow-sm ring-2 ring-white"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-stone-800 text-lg font-bold uppercase tracking-tight text-white shadow-sm">
              {form.displayName.slice(0, 2)}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-stone-900">Аватар в шапке</p>
            <p className="mt-0.5 text-xs text-stone-500">
              JPEG, PNG или WebP. Квадрат обрежется по центру.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadAvatar(f);
            }}
          />
          <button
            type="button"
            disabled={avatarBusy}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-50"
            onClick={() => avatarInputRef.current?.click()}
          >
            {avatarBusy ? "Загрузка…" : "Загрузить фото"}
          </button>
          {avatarPreviewUrl ? (
            <button
              type="button"
              disabled={avatarBusy}
              className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
              onClick={() => void removeAvatar()}
            >
              Убрать
            </button>
          ) : null}
        </div>
      </div>
      {avatarError ? (
        <p className="text-sm text-red-600">{avatarError}</p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">
              Фото на странице «Обо мне»
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              JPEG, PNG или WebP, до 20 МБ. Отобразится на странице /about.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={aboutPhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadAboutPhoto(f);
              }}
            />
            <button
              type="button"
              disabled={aboutPhotoBusy}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-50"
              onClick={() => aboutPhotoInputRef.current?.click()}
            >
              {aboutPhotoBusy ? "Загрузка…" : "Загрузить"}
            </button>
            {aboutPhotoUrl ? (
              <button
                type="button"
                disabled={aboutPhotoBusy}
                className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
                onClick={() => void removeAboutPhoto()}
              >
                Убрать
              </button>
            ) : null}
          </div>
        </div>
        {aboutPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={aboutPhotoUrl}
            alt=""
            className="w-full max-h-64 rounded-xl object-cover"
          />
        ) : null}
        {aboutPhotoError ? (
          <p className="text-sm text-red-600">{aboutPhotoError}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">
          Имя / псевдоним
          <input
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 outline-none focus:border-stone-400"
            value={form.displayName}
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Короткое описание (шапка)
          <input
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 outline-none focus:border-stone-400"
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Название ссылки «Контакты» (шапка и блок соцсетей на странице «Обо мне»)
          <input
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 outline-none focus:border-stone-400"
            placeholder="Контакты"
            value={form.contactsLabel}
            onChange={(e) =>
              setForm((f) => ({ ...f, contactsLabel: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Био (кратко, для страницы «Обо мне»)
          <textarea
            className="mt-1 min-h-[80px] w-full rounded-2xl border border-stone-300 px-3 py-2.5 outline-none focus:border-stone-400"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Текст страницы «Обо мне»
          <textarea
            className="mt-1 min-h-[140px] w-full rounded-2xl border border-stone-300 px-3 py-2.5 outline-none focus:border-stone-400"
            value={form.aboutMarkdown}
            onChange={(e) =>
              setForm((f) => ({ ...f, aboutMarkdown: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm font-medium">
          Публичный URL сайта (canonical)
          <input
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-400"
            value={form.siteUrl}
            onChange={(e) => setForm((f) => ({ ...f, siteUrl: e.target.value }))}
          />
        </label>
        <label className="block text-sm font-medium">
          Язык по умолчанию (задел под i18n)
          <select
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 outline-none focus:border-stone-400"
            value={form.defaultLocale}
            onChange={(e) =>
              setForm((f) => ({ ...f, defaultLocale: e.target.value }))
            }
          >
            <option value="ru">ru</option>
            <option value="en">en</option>
          </select>
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Username Telegram-канала для импорта (без @)
          <input
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-400"
            value={form.telegramChannelUser}
            onChange={(e) =>
              setForm((f) => ({ ...f, telegramChannelUser: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm font-medium">
          Plausible domain
          <input
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-400"
            placeholder="example.com"
            value={form.plausibleDomain}
            onChange={(e) =>
              setForm((f) => ({ ...f, plausibleDomain: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm font-medium">
          Яндекс.Метрика — номер счётчика
          <input
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-400"
            placeholder="например 12345678"
            inputMode="numeric"
            value={form.yandexMetrikaId}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                yandexMetrikaId: e.target.value.replace(/\D/g, ""),
              }))
            }
          />
          <span className="mt-1 block text-xs text-stone-500">
            Создайте счётчик на{" "}
            <a
              href="https://metrika.yandex.ru/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-700"
            >
              metrika.yandex.ru
            </a>
            , скопируйте только цифры. Либо задайте{" "}
            <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_YANDEX_METRIKA_ID</code>{" "}
            в .env / Vercel.
          </span>
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Соцсети</h2>
          <button
            type="button"
            className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-700 shadow-sm"
            onClick={addSocial}
          >
            + Ссылка
          </button>
        </div>
        <ul className="space-y-3">
          {form.social.map((s) => (
            <li
              key={s.id}
              className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50/70 p-3 sm:grid-cols-4"
            >
              <input
                className="rounded-xl border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-stone-400"
                value={s.label}
                onChange={(e) => updateSocial(s.id, { label: e.target.value })}
                placeholder="Подпись"
              />
              <input
                className="sm:col-span-2 rounded-xl border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-stone-400"
                value={s.url}
                onChange={(e) => updateSocial(s.id, { url: e.target.value })}
                placeholder="https://"
              />
              <div className="flex gap-2">
                <select
                  className="w-full rounded-xl border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-stone-400"
                  value={s.kind}
                  onChange={(e) =>
                    updateSocial(s.id, {
                      kind: e.target.value as SocialLink["kind"],
                    })
                  }
                >
                  <option value="telegram">Telegram</option>
                  <option value="behance">Behance</option>
                  <option value="instagram">Instagram</option>
                  <option value="email">Почта</option>
                  <option value="other">Другое</option>
                </select>
                <button
                  type="button"
                  className="rounded-xl px-2 text-sm text-red-600"
                  onClick={() => removeSocial(s.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {message ? <p className="text-sm text-stone-600">{message}</p> : null}

      <button
        type="button"
        className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
        onClick={() => void save()}
      >
        Сохранить настройки
      </button>
    </div>
  );
}
