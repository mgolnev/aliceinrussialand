-- A post may be published only in its category, without appearing in the
-- public "Все" feed. Existing posts remain visible there by default.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Post'
      AND column_name = 'showInAll'
  ) THEN
    ALTER TABLE "Post"
      ADD COLUMN "showInAll" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Post_status_showInAll_pinned_publishedAt_idx"
  ON "Post"("status", "showInAll", "pinned", "publishedAt" DESC);
