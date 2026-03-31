-- Add Yandex Webmaster verification meta value (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SiteSettings'
      AND column_name = 'yandexVerification'
  ) THEN
    ALTER TABLE "SiteSettings"
      ADD COLUMN "yandexVerification" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;
