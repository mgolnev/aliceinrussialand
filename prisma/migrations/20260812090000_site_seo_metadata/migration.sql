-- SEO fields for the home page. Kept idempotent for existing Amvera databases.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SiteSettings'
      AND column_name = 'seoTitle'
  ) THEN
    ALTER TABLE "SiteSettings"
      ADD COLUMN "seoTitle" TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SiteSettings'
      AND column_name = 'seoDescription'
  ) THEN
    ALTER TABLE "SiteSettings"
      ADD COLUMN "seoDescription" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;
