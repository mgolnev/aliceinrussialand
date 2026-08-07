-- Поля уже используются в production. Добавлены в репозиторий для точного
-- восстановления локальной копии и последующего переноса на Amvera.
ALTER TABLE "PostCategory"
  ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "oldSlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Post"
  ADD COLUMN "oldSlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
