-- RenameColumn: Google Analytics → Яндекс.Метрика (идемпотентно: повторный прогон / колонка уже переименована)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SiteSettings'
      AND column_name = 'gaMeasurementId'
  ) THEN
    ALTER TABLE "SiteSettings" RENAME COLUMN "gaMeasurementId" TO "yandexMetrikaId";
  END IF;
END $$;
