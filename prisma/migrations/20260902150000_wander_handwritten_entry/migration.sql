UPDATE "SiteSettings"
SET "wanderEntryLabel" = 'не жми сюда'
WHERE "wanderEntryLabel" = 'не нажимай сюда';

ALTER TABLE "SiteSettings"
ALTER COLUMN "wanderEntryLabel" SET DEFAULT 'не жми сюда';
