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

> **Важно:** это делается в **[дашборде Supabase](https://supabase.com/dashboard)** (ваш проект), **не** на вкладке **Storage** у Vercel — там другой экран (маркетплейс).

1. Supabase → выберите проект → в меню слева → **Storage** → **New bucket**.
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

## Supabase готов? Быстрая проверка

Перед Vercel убедитесь:

| # | Что | Как проверить |
|---|-----|----------------|
| 1 | Проект Supabase создан | Открывается дашборд проекта |
| 2 | Postgres | **Table Editor** — после первого деплоя появятся таблицы `Post`, `SiteSettings`… Или до деплоя: локально `npx prisma migrate deploy` с вашими `DATABASE_URL` / `DIRECT_URL` |
| 3 | **Storage** | Bucket **`media`** (или другое имя) существует и **публичный**, если нужны прямые URL картинок |
| 4 | Строки подключения | Скопированы **pooler** (6543) и **direct** (5432) — см. §1.2 |
| 5 | Секреты API | `SUPABASE_URL` = Project URL, **service_role** только для сервера |
| 6 | Опционально Auth | Если используете Supabase Login в приложении: **anon** или **Publishable** ключ → `NEXT_PUBLIC_SUPABASE_ANON_KEY` или `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, плюс `NEXT_PUBLIC_SUPABASE_URL` (см. `.env.example`) |

Если пункты 1–5 выполнены — можно идти на Vercel. Пункт 6 не обязателен для текущей админки (она на своём JWT).

---

## Шаг 2. Vercel (пошагово)

### Шаг 2.1 — Аккаунт и импорт

1. Зайдите на [vercel.com](https://vercel.com), войдите (лучше через **GitHub**).
2. **Add New…** → **Project**.
3. Нажмите **Import** напротив репозитория **`mgolnev/aliceinrussialand`** (если списка нет — **Adjust GitHub App Permissions** и дайте доступ к репо).
4. **Root Directory** оставьте `.` (корень), **Framework Preset** — **Next.js**.

### Шаг 2.2 — Команда сборки (до первого Deploy)

На экране настройки проекта раскройте **Build & Output Settings** и задайте:

- **Build Command:**

  ```bash
  prisma migrate deploy && prisma generate && next build
  ```

- **Install Command:** `npm install` (по умолчанию).
- Остальное не трогайте, если Vercel сам подставил стандарт для Next.js.

### Шаг 2.3 — Переменные окружения (на том же экране или Settings → Environment Variables)

Добавьте для **Production** (галочка *Production*; для Preview — по желанию те же значения):

| Имя | Значение |
|-----|----------|
| `DATABASE_URL` | Supabase → Database → **Transaction pooler** / URI, порт **6543** |
| `DIRECT_URL` | Supabase → Database → **Direct**, порт **5432** |
| `SESSION_SECRET` | Случайная строка **≥ 32** символов (сгенерируйте в любом генераторе) |
| `ADMIN_PASSWORD_HASH` | bcrypt-хэш вашего пароля админки; в Vercel **не нужно** экранировать `$` как в локальном `.env` — вставляйте хэш как есть |
| `NEXT_PUBLIC_SITE_URL` | Пока можно `https://ИМЯ-ПРОЕКТА.vercel.app` (после первого деплоя скопируйте точный URL из Vercel и при необходимости обновите переменную и **Настройки сайта** в админке) |
| `SUPABASE_URL` | Тот же URL, что и Project URL (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** из Settings → API |
| `SUPABASE_STORAGE_BUCKET` | Имя bucket, например `media` |

Опционально:

| Имя | Значение |
|-----|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | = `SUPABASE_URL`, если нужен refresh сессии Supabase Auth в браузере |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` или `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Публичный ключ из Settings → API |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Аналитика |

### Шаг 2.4 — Первый деплой

1. Нажмите **Deploy**.
2. Дождитесь логов: этап `prisma migrate deploy` должен пройти без ошибок (создадутся таблицы).
3. Если сборка упала на миграциях — чаще всего неверный `DATABASE_URL` / `DIRECT_URL` или БД недоступна с сети Vercel (у Supabase обычно ок).

### Шаг 2.5 — После успешного деплоя

1. Откройте выданный URL (`…vercel.app`).
2. Зайдите в **`/admin/login`**, войдите паролем от `ADMIN_PASSWORD_HASH`.
3. Если ошибка входа — проверьте, что хэш в Vercel совпадает с тем паролем, который вводите.
4. Если нет строк в **Настройках** / пустая лента — один раз выполните с **своего компьютера** (подставьте строки из Supabase):

   ```bash
   DATABASE_URL="pooler-строка" DIRECT_URL="direct-строка" npx prisma db seed
   ```

5. В админке **Настройки** укажите **URL сайта** = ваш продакшен URL с Vercel (для canonical и OG).

### Шаг 2.6 — Домен (по желанию)

**Project → Settings → Domains** — добавьте свой домен и следуйте подсказкам DNS.

Если добавили или сменили переменные окружения после деплоя — **Deployments → … → Redeploy**.

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
