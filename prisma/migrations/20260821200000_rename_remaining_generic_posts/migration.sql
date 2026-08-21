-- Две публикации появились в проде уже после первой сверки. У них были
-- осмысленные SEO-title, но H1 и URL всё ещё оставались «Новая публикация».

UPDATE "Post"
SET
  "title" = 'Графика: рыба в шортах',
  "slug" = 'grafika-ryba-v-shortah',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya-7' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya-7')
  END
WHERE "slug" = 'novaya-publikaciya-7'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'grafika-ryba-v-shortah');

UPDATE "Post"
SET
  "title" = 'Портретный набросок',
  "slug" = 'portretnyj-nabrosok',
  "oldSlugs" = CASE
    WHEN 'novaya-publikaciya-8' = ANY("oldSlugs") THEN "oldSlugs"
    ELSE array_append("oldSlugs", 'novaya-publikaciya-8')
  END
WHERE "slug" = 'novaya-publikaciya-8'
  AND "status" = 'PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM "Post" AS target WHERE target."slug" = 'portretnyj-nabrosok');
