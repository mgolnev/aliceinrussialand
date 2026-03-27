# Порядок настройки: Supabase → Vercel → GitHub

Репозиторий: [github.com/mgolnev/aliceinrussialand](https://github.com/mgolnev/aliceinrussialand)

---

## Шаг 1. Supabase (сначала база и хранилище)

### 1.1 Проект

1. Зайдите на [supabase.com](https://supabase.com) → **New project**.
2. Задайте имя, пароль для БД (сохраните), регион.
3. Дождитесь создания проекта.

### 1.2 Строки подключения к PostgreSQL

1. **Project Settings** (шестерёнка) → **Database**.
2. В блоке **Connection string**:
   - Режим **Transaction pooler** (или **URI**, порт **6543**, часто с `?pgbouncer=true`) — скопируйте строку → это будет **`DATABASE_URL`** на Vercel.
   - Режим **Direct connection** (порт **5432**) — скопируйте строку → это **`DIRECT_URL`** на Vercel.

Подставьте реальный пароль вместо `[YOUR-PASSWORD]`, если в строке плейсхолдер.

### 1.3 Хранилище картинок (Storage)

1. В меню слева → **Storage** → **New bucket**.
2. Имя, например: **`media`**.
3. Включите **Public bucket** (чтобы картинки открывались по URL в ленте).  
   Если оставите приватным — понадобятся signed URLs (в текущем коде не реализовано).

### 1.4 Ключи API для загрузки файлов

1. **Project Settings** → **API**.
2. Скопируйте:
   - **Project URL** → **`SUPABASE_URL`**
   - **service_role** `secret` (не `anon`!) → **`SUPABASE_SERVICE_ROLE_KEY`**  
     ⚠️ Только на сервере (Vercel Environment Variables), никогда в клиентский код и не в публичные репозитории.

### 1.5 Переменные, которые вы заберёте из Supabase

| Переменная | Где взять |
|------------|-----------|
| `DATABASE_URL` | Database → Connection string → **Pooler** / Transaction (6543) |
| `DIRECT_URL` | Database → **Direct** (5432) |
| `SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role |
| `SUPABASE_STORAGE_BUCKET` | Имя bucket, например `media` |

Миграции таблиц выполнит Vercel при первой сборке (см. шаг 2) или вы можете один раз выполнить локально:

```bash
DATABASE_URL="..." DIRECT_URL="..." npx prisma migrate deploy
npx prisma db seed
```

---

## Шаг 2. Vercel

### 2.1 Импорт проекта

1. [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** репозиторий `mgolnev/aliceinrussialand` (подключите GitHub, если ещё не подключали).

### 2.2 Сборка

- **Framework Preset:** Next.js (определится сам).
- **Build Command** (важно):

  ```bash
  prisma migrate deploy && prisma generate && next build
  ```

- **Install Command:** `npm install` (по умолчанию).
- **Output:** по умолчанию для Next.js.

### 2.3 Переменные окружения (Settings → Environment Variables)

Добавьте для **Production** (и при желании Preview):

| Имя | Значение |
|-----|----------|
| `DATABASE_URL` | Из Supabase (pooler) |
| `DIRECT_URL` | Из Supabase (direct) |
| `SESSION_SECRET` | Длинная случайная строка (≥ 32 символов) |
| `ADMIN_PASSWORD_HASH` | bcrypt-хэш пароля админки (в строке экранируйте `$` как `\$`) |
| `NEXT_PUBLIC_SITE_URL` | `https://ваш-проект.vercel.app` или ваш домен |
| `SUPABASE_URL` | Из Supabase API |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role |
| `SUPABASE_STORAGE_BUCKET` | `media` (или как назвали bucket) |

Опционально: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

После сохранения — **Redeploy**, если деплой уже был без переменных.

### 2.4 Домен

**Settings → Domains** — при необходимости подключите свой домен.  
В админке сайта (**Настройки**) укажите тот же URL в поле сайта, чтобы canonical и Open Graph совпадали с продакшеном.

### 2.5 Первый вход

1. Откройте `https://…vercel.app/admin/login`.
2. Войдите паролем, от которого считали `ADMIN_PASSWORD_HASH`.
3. Если лента пуста и нет настроек — выполните **seed** (локально с вашими `DATABASE_URL` / `DIRECT_URL` или через Supabase SQL, если знаете как):  
   `npx prisma db seed`

---

## Шаг 3. GitHub (у вас уже есть репозиторий)

После пуша в `main` Vercel обычно сам пересобирает проект.

```bash
git remote add origin https://github.com/mgolnev/aliceinrussialand.git   # если ещё не добавлен
git push -u origin main
```

Если `origin` уже есть на другой URL:

```bash
git remote set-url origin https://github.com/mgolnev/aliceinrussialand.git
git push -u origin main
```

---

## Краткий чеклист

- [ ] Supabase: проект создан  
- [ ] Supabase: `DATABASE_URL` + `DIRECT_URL` сохранены  
- [ ] Supabase: публичный bucket `media`  
- [ ] Supabase: `SUPABASE_URL` + service_role  
- [ ] Vercel: репозиторий импортирован  
- [ ] Vercel: Build Command с `prisma migrate deploy`  
- [ ] Vercel: все переменные окружения  
- [ ] GitHub: код запушен в `main`  
- [ ] Сайт открывается, админка работает, загрузка фото попадает в Storage  

Более общая заметка: [DEPLOYMENT.md](./DEPLOYMENT.md).
