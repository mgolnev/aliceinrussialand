-- Автоматический SEO: источник значения сохраняет приоритет ручной правки.
ALTER TABLE "Post"
  ADD COLUMN "metaTitleSource" TEXT NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "metaDescriptionSource" TEXT NOT NULL DEFAULT 'AUTO';

ALTER TABLE "PostImage"
  ADD COLUMN "altSource" TEXT NOT NULL DEFAULT 'AUTO';

-- Уже заполненные поля принадлежат автору: AI никогда не перепишет их при включении функции.
UPDATE "Post"
SET "metaTitleSource" = 'MANUAL'
WHERE btrim("metaTitle") <> '';

UPDATE "Post"
SET "metaDescriptionSource" = 'MANUAL'
WHERE btrim("metaDescription") <> '';

UPDATE "PostImage"
SET "altSource" = 'MANUAL'
WHERE btrim("alt") <> '';

CREATE TABLE "AiSeoJob" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "inputHash" TEXT NOT NULL DEFAULT '',
  "outputJson" TEXT NOT NULL DEFAULT '{}',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiSeoJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiSeoJob_postId_type_subjectKey_key"
  ON "AiSeoJob"("postId", "type", "subjectKey");
CREATE INDEX "AiSeoJob_status_runAfter_idx" ON "AiSeoJob"("status", "runAfter");
CREATE INDEX "AiSeoJob_postId_updatedAt_idx" ON "AiSeoJob"("postId", "updatedAt");

ALTER TABLE "AiSeoJob"
  ADD CONSTRAINT "AiSeoJob_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
