-- RenameColumn: Google Analytics → Яндекс.Метрика (номер счётчика)
ALTER TABLE "SiteSettings" RENAME COLUMN "gaMeasurementId" TO "yandexMetrikaId";
