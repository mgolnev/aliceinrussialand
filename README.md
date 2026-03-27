# Alice in Russialand — лента иллюстратора (MVP)

Публичный сайт в формате **мобильной ленты постов** с простой админкой, оптимизацией изображений и **выборочным импортом** из открытого Telegram-канала (парсинг `t.me/s/username`).

## Стек

- **Next.js 16** (App Router, SSR для SEO)
- **Tailwind CSS 4**
- **Prisma 5 + PostgreSQL** (локально через Docker или Supabase; см. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
- **Sharp** — ресайз и WebP-пресеты (640 / 960 / 1280)
- **bcryptjs + jose** — вход в админку (HTTP-only cookie)
- **@dnd-kit** — сортировка фото в редакторе
- **cheerio** — разбор HTML витрины Telegram (на сервере)

## Структура проекта

```
src/app/                 — страницы и route handlers
  page.tsx               — главная лента
  p/[slug]/page.tsx      — отдельный URL поста + OG/JSON-LD
  about/page.tsx         — «О художнике»
  admin/                 — админка (посты, настройки, Telegram)
  api/                   — feed, auth, admin API
src/components/          — лента, хром сайта, редактор, настройки
src/lib/                 — prisma, сессия, изображения, Telegram
prisma/schema.prisma     — модель данных
storage/originals/       — оригиналы загрузок (не в git)
public/media/            — оптимизированные файлы (не в git)
```

## Модель данных

- **SiteSettings** (одна запись `id = 1`): имя, описания, JSON соцссылок, URL сайта, username канала для импорта, домен Plausible, GA id, `defaultLocale` (`ru` / `en`) — задел под i18n.
- **Post**: `slug`, `title`, `body`, `status` (`DRAFT` | `PUBLISHED`), `publishedAt`, `pinned`, SEO-поля, `telegramSourceUrl`, `locale`.
- **PostImage**: порядок `sortOrder`, подпись, `alt`, `variantsJson` (пути к WebP), метаданные.

## Запуск локально

```bash
npm install
cp .env.example .env
# Укажите DATABASE_URL и DIRECT_URL (см. .env.example). Быстрый вариант — Postgres в Docker:
docker compose up -d
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000). Админка: `/admin` (пароль задаётся через `ADMIN_PASSWORD_HASH` в `.env` — **смените в продакшене**).

**Продакшен (GitHub + Vercel + Supabase):** по порядку — [docs/VERCEL_SUPABASE.md](docs/VERCEL_SUPABASE.md); дополнительно [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Хэш пароля админа

```bash
node -e "console.log(require('bcryptjs').hashSync('ВАШ_ПАРОЛЬ',10))"
```

Вставьте результат в `ADMIN_PASSWORD_HASH` в `.env`.

**Важно:** в строке bcrypt каждый символ `$` нужно экранировать как `\$`, иначе Next.js при чтении `.env` воспримет `$2b` и т.д. как подстановку переменных и хэш станет пустым (ошибка «ADMIN_PASSWORD_HASH не задан»). Пример: `ADMIN_PASSWORD_HASH="\$2b\$10\$..."`.

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | PostgreSQL (на Vercel — pooler Supabase, порт 6543) |
| `DIRECT_URL` | Прямое подключение к Postgres (Supabase порт 5432) для миграций |
| `SESSION_SECRET` | Секрет JWT сессии (≥16 символов) |
| `ADMIN_PASSWORD_HASH` | bcrypt-хэш пароля админа |
| `NEXT_PUBLIC_SITE_URL` | Публичный URL (canonical, шаринг, sitemap) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Медиа на Vercel (без них локально используются `public/media`) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Опционально: домен в Plausible |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Опционально: G-… для GA4 |
| `MEDIA_ROOT` | Локально: корень для `storage/originals` |

## Где менять настройки сайта

1. В админке: **Настройки** — имя, описание, страница «О художнике», соцссылки, URL сайта, Plausible/GA, username канала для импорта.
2. Сиды по умолчанию: `prisma/seed.ts` (первичные тексты и ссылки).

## Изображения

- **Локально (без Supabase):** оригинал в `storage/originals/`, варианты WebP в `public/media/{postId}/{imageId}/`.
- **Продакшен (Vercel):** задайте `SUPABASE_*` — варианты загружаются в **Supabase Storage**, в БД хранятся полные публичные URL.
- На фронте: `<picture>` + `loading="lazy"`.

## Telegram (MVP)

1. Канал должен быть **публичным** (доступна витрина `https://t.me/s/channelname`).
2. В **Настройках** укажите username без `@` или введите его на странице **Telegram** в админке.
3. **Загрузить список** → отметьте посты → **Импортировать** (черновики или сразу опубликованные).

Ограничения: разметка `t.me` может меняться; парсинг не заменяет полноценный Bot API / user API. Для закрытых каналов потребуется другая интеграция.

## SEO

- У каждого поста: `/p/{slug}`, `generateMetadata`, Open Graph, `canonical`, `Article` JSON-LD.
- `sitemap.xml`, `robots.txt` (закрыты `/admin/` и `/api/`).

## Аналитика

- **Plausible**: домен в настройках или `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; события `PostView`, `ScrollDepth` (если доступен `window.plausible`).
- **GA4**: id в настройках или `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

## Деплой

- Локально: `npm run build` → `npm start`.
- **Vercel + Supabase:** см. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (миграции Prisma, переменные окружения, публичный bucket для медиа).

## Полезные команды

```bash
npm run dev          # разработка
npm run build        # продакшен-сборка
npm run db:studio    # Prisma Studio
npx prisma migrate deploy  # применить миграции к Postgres
npm run db:seed      # сиды
```
