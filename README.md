# Alice in Russialand — лента иллюстратора (MVP)

Публичный сайт в формате **мобильной ленты постов** с простой админкой, оптимизацией изображений и **выборочным импортом** из открытого Telegram-канала (парсинг `t.me/s/username`).

## Локальная разработка и выкладка

**1. Запуск на своей машине**

```bash
npm install
cp .env.example .env
```

В `.env` задайте как минимум `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `NEXT_PUBLIC_SITE_URL` (см. комментарии в [`.env.example`](.env.example)). Быстрый вариант с Postgres в Docker:

```bash
docker compose up -d
npx prisma migrate deploy
npx prisma db seed   # при первом клоне или пустой БД
npm run dev
```

Сайт: [http://localhost:3000](http://localhost:3000). Админка: **`/admin`** (пароль — тот, для которого вы сгенерировали `ADMIN_PASSWORD_HASH`; в продакшене используйте свой надёжный пароль).

Опционально для загрузки файлов в облако как на проде: добавьте в `.env` переменные `SUPABASE_*` (иначе локально файлы пишутся в `public/media`).

**2. Изменения → GitHub → автодеплой**

Разработка ведётся **локально**. Когда готово:

```bash
git add .
git commit -m "краткое описание изменений"
git push origin main
```

Если в [Vercel](https://vercel.com) проект привязан к этому репозиторию, после `push` запускается **сборка и деплой** без ручных шагов. Переменные окружения на Vercel и порядок первичной настройки Supabase — в [docs/VERCEL_SUPABASE.md](docs/VERCEL_SUPABASE.md); краткий чеклист — [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Хэш пароля админа (для `.env`)

```bash
node -e "console.log(require('bcryptjs').hashSync('ВАШ_ПАРОЛЬ',10))"
```

Вставьте результат в `ADMIN_PASSWORD_HASH`. **Важно:** в `.env` каждый символ `$` в bcrypt-хэше экранируйте как `\$`, иначе Next.js обрежет значение. Пример: `ADMIN_PASSWORD_HASH="\$2b\$10\$..."`.

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

- **SiteSettings** (одна запись `id = 1`): имя, описания, JSON соцссылок, URL сайта, username канала для импорта, домен Plausible, номер счётчика Яндекс.Метрики, `defaultLocale` (`ru` / `en`) — задел под i18n.
- **Post**: `slug`, `title`, `body`, `status` (`DRAFT` | `PUBLISHED`), `publishedAt`, `pinned`, SEO-поля, `telegramSourceUrl`, `locale`.
- **PostImage**: порядок `sortOrder`, подпись, `alt`, `variantsJson` (пути к WebP), метаданные.

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
| `NEXT_PUBLIC_YANDEX_METRIKA_ID` | Опционально: номер счётчика Яндекс.Метрики (цифры); дублирует поле в админке |
| `MEDIA_ROOT` | Локально: корень для `storage/originals` |

## Где менять настройки сайта

1. В админке: **Настройки** — имя, описание, страница «О художнике», соцссылки, URL сайта, Plausible / Яндекс.Метрика, username канала для импорта.
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

- **Plausible** (опционально): домен в настройках или `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; события `PostView`, `ScrollDepth`.
- **Яндекс.Метрика**: номер счётчика в **Настройках** или в `NEXT_PUBLIC_YANDEX_METRIKA_ID`. Подключается счётчик `mc.yandex.ru`, визиты и клики считаются автоматически. Дополнительно отправляются цели JavaScript: `post_feed_view` (параметр `slug` — при показе карточки в ленте) и `scroll_depth` (параметр `depth: "65"`). Создайте в интерфейсе Метрики цели с такими идентификаторами или проверьте отчёт «Конверсии» после появления данных.

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
