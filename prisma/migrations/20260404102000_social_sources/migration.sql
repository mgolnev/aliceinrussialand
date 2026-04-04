-- Универсальные источники импорта для постов (поверх telegramSourceUrl).
CREATE TYPE "SocialSourcePlatform" AS ENUM ('TELEGRAM', 'INSTAGRAM', 'BEHANCE');

ALTER TABLE "Post"
ADD COLUMN "sourcePlatform" "SocialSourcePlatform",
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceExternalId" TEXT;

CREATE INDEX "Post_sourcePlatform_sourceUrl_idx"
ON "Post"("sourcePlatform", "sourceUrl");

CREATE INDEX "Post_sourcePlatform_sourceExternalId_idx"
ON "Post"("sourcePlatform", "sourceExternalId");
