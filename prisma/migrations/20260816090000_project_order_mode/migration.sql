-- Existing collections switch to the same newest-first order as the main feed.
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "orderMode" TEXT NOT NULL DEFAULT 'NEWEST_FIRST';
