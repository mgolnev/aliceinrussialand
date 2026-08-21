-- Исторические URL остаются в oldSlugs, а публичный маршрут делает 301
-- на новый канонический адрес. Меняем только реальные опубликованные записи.

UPDATE "Post"
SET
  "title" = 'Керамика из серии «Ритуал»',
  "slug" = 'keramika-serii-ritual',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya')
  END
WHERE "slug" = 'novaya-publikaciya'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'keramika-serii-ritual');

UPDATE "Post"
SET
  "title" = 'Динамо: мурал со спортсменами',
  "slug" = 'dinamo-mural-so-sportsmenami',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya-1' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya-1')
  END
WHERE "slug" = 'novaya-publikaciya-1'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'dinamo-mural-so-sportsmenami');

UPDATE "Post"
SET
  "title" = 'Пленэрная графика: холмистый луг',
  "slug" = 'plenernaya-grafika-holmistyj-lug',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya-2' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya-2')
  END
WHERE "slug" = 'novaya-publikaciya-2'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'plenernaya-grafika-holmistyj-lug');

UPDATE "Post"
SET
  "title" = 'Деревенский пейзаж под грозовым небом',
  "slug" = 'derevenskij-pejzazh-pod-grozovym-nebom',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya-3' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya-3')
  END
WHERE "slug" = 'novaya-publikaciya-3'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'derevenskij-pejzazh-pod-grozovym-nebom');

UPDATE "Post"
SET
  "title" = 'Керамические работы и скульптура',
  "slug" = 'keramicheskie-raboty-i-skulptura',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya-4' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya-4')
  END
WHERE "slug" = 'novaya-publikaciya-4'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'keramicheskie-raboty-i-skulptura');

UPDATE "Post"
SET
  "title" = 'Колокольня в Коломне',
  "slug" = 'kolokolnya-v-kolomne',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya-5' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya-5')
  END
WHERE "slug" = 'novaya-publikaciya-5'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'kolokolnya-v-kolomne');

UPDATE "Post"
SET
  "title" = 'Графика с пленэра: пейзаж у воды',
  "slug" = 'grafika-s-plenera-pejzazh-u-vody',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya-6' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya-6')
  END
WHERE "slug" = 'novaya-publikaciya-6'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'grafika-s-plenera-pejzazh-u-vody');

-- Если старую категорию ещё не объединили вручную, сохраняем её адрес как
-- исторический. В текущей базе grafika уже существует, поэтому этот блок
-- безопасно ничего не сделает.
UPDATE "PostCategory"
SET
  "slug" = 'grafika',
  "oldSlugs" = CASE
    WHEN 'illyustraciya' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'illyustraciya')
  END
WHERE "slug" = 'illyustraciya'
  AND NOT EXISTS (SELECT 1 FROM "PostCategory" AS target WHERE target."slug" = 'grafika');
