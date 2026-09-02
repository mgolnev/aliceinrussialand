ALTER TABLE "SiteSettings"
ADD COLUMN IF NOT EXISTS "wanderEntryLabel" TEXT NOT NULL DEFAULT 'не нажимай сюда';
