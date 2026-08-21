# Развёртывание на Amvera

Проект разворачивается как Docker-приложение. [`amvera.yaml`](../amvera.yaml)
указывает порт `3000` и постоянный том `/app/public/media`; [`Dockerfile`](../Dockerfile)
собирает Next.js в standalone-режиме.

## Переменные и миграции

В панели Amvera добавьте секреты основного приложения:

- `DATABASE_URL`, `DIRECT_URL`;
- `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`;
- `NEXT_PUBLIC_SITE_URL=https://aliceinrussialand.ru`;
- при внешнем хранилище: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_STORAGE_BUCKET`;
- для автоматического SEO: `OPENROUTER_API_KEY`, `OPENROUTER_SEO_MODEL`,
  `CRON_SECRET` и, если нужен исходящий прокси, `OPENROUTER_OUTBOUND_PROXY`
  или общий `TELEGRAM_OUTBOUND_PROXY`.

При каждом запуске [`docker-entrypoint.sh`](../docker-entrypoint.sh) применяет
`prisma migrate deploy` до старта Next.js. Поэтому миграцию AI SEO не нужно запускать
вручную на сервере: она выполнится с первым деплоем версии, где есть папка
`prisma/migrations/20260820100000_ai_seo_jobs`.

## Выкладка

1. Закоммитьте изменения и отправьте их в ветку, подключённую к Amvera.
2. Проверьте **Лог сборки** и затем **Лог приложения**: после миграции приложение
   должно начать слушать порт `3000`.
3. Откройте `/admin`, опубликуйте тестовый пост с фотографией и проверьте статус
   в разделе «Slug и SEO».

## Повторные AI-задачи

`after` запускает обработку сразу после публикации. Чтобы переживать сбой сети или
перезапуск контейнера, добавьте отдельный Amvera Cron Job по инструкции
[AMVERA_SEO_CRON.md](./AMVERA_SEO_CRON.md).
