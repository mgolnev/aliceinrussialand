# Релиз: GitHub + Vercel + Supabase

Краткий чеклист для выкладки в продакшен.

## 1. Supabase: база данных

1. Создайте проект в [Supabase](https://supabase.com).
2. **Settings → Database** скопируйте:
   - **Connection string** с режимом **Transaction pooler** (URI) → это `DATABASE_URL` для Vercel.
   - **Connection string** с режимом **Direct** (URI) → это `DIRECT_URL` для миграций Prisma.
3. В **SQL Editor** можно один раз применить схему вручную, либо использовать миграции (шаг 4).

## 2. Supabase: хранилище картинок

На Vercel локальная файловая система не подходит для загрузок: используйте **Storage**.

1. **Storage → New bucket**, имя например `media`.
2. Включите **Public bucket** (или настройте политики RLS под публичное чтение).
3. **Settings → API**: скопируйте `Project URL` и `service_role` (только для сервера, не в клиент).

Переменные окружения:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=media`

Локально, без этих переменных, приложение по-прежнему пишет файлы в `public/media` (удобно для разработки).

## 3. GitHub

```bash
git add .
git commit -m "chore: production setup with Postgres and Supabase Storage"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## 4. Vercel

1. **Import** репозитория из GitHub.
2. **Framework Preset:** Next.js.
3. **Build Command** (рекомендуется):

   ```bash
   prisma migrate deploy && prisma generate && next build
   ```

4. **Install Command:** `npm install` (по умолчанию).

5. Добавьте **Environment Variables** (скопируйте из `.env.example` и своих секретов):

   | Переменная | Где взять |
   |------------|-----------|
   | `DATABASE_URL` | Supabase, pooler |
   | `DIRECT_URL` | Supabase, direct |
   | `SESSION_SECRET` | Случайная строка ≥ 32 символов |
   | `ADMIN_PASSWORD_HASH` | bcrypt-хэш пароля админки |
   | `NEXT_PUBLIC_SITE_URL` | `https://ваш-проект.vercel.app` или свой домен |
   | `SUPABASE_URL` | Supabase API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase (service_role) |
   | `SUPABASE_STORAGE_BUCKET` | Имя bucket, например `media` |
   | Опционально | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` |

6. После первого деплоя выполните **seed** один раз (с машины с доступом к БД):

   ```bash
   DATABASE_URL="..." DIRECT_URL="..." npx prisma db seed
   ```

   Либо заполните **Site Settings** через админку после входа.

## 5. Домен и URL сайта

В **Vercel → Settings → Domains** привяжите домен. В **админке → Настройки** (или в `SiteSettings`) укажите тот же URL в поле сайта, чтобы canonical и Open Graph совпадали с продакшеном.

## 6. Проверка

- Главная открывается, лента грузится.
- Вход в `/admin/login`, создание поста, загрузка фото — файлы появляются в bucket Supabase.
- Импорт из Telegram (если используете) — с сервера Vercel должен быть доступен внешний HTTP; при блокировках проверьте логи функций.

## Локальная разработка после перехода на Postgres

Скопируйте `DATABASE_URL` и `DIRECT_URL` из Supabase в локальный `.env` (или используйте отдельный dev-проект Supabase). SQLite больше не используется.
