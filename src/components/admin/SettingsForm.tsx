"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import type { SocialLink } from "@/lib/site";

type Props = {
  initial: {
    displayName: string;
    tagline: string;
    bio: string;
    aboutMarkdown: string;
    telegramChannelUser: string;
    siteUrl: string;
    plausibleDomain: string;
    gaMeasurementId: string;
    defaultLocale: string;
    social: SocialLink[];
  };
};

export function SettingsForm({ initial }: Props) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);

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
        siteUrl: form.siteUrl,
        plausibleDomain: form.plausibleDomain,
        gaMeasurementId: form.gaMeasurementId,
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

  return (
    <div className="space-y-6 rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
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
          Google Analytics (G-...)
          <input
            className="mt-1 w-full rounded-2xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-400"
            value={form.gaMeasurementId}
            onChange={(e) =>
              setForm((f) => ({ ...f, gaMeasurementId: e.target.value }))
            }
          />
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
