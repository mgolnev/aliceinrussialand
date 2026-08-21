-- У части старых публикаций уже был осмысленный H1, но в metaTitle остался
-- технический текст «Новая публикация». Исправляем только этот точный шаблон,
-- не затрагивая ручные осмысленные SEO-title.

UPDATE "Post"
SET "metaTitle" = 'Динамо: мурал со спортсменами', "metaTitleSource" = 'AUTO'
WHERE "slug" = 'dinamo-mural-so-sportsmenami'
  AND btrim("metaTitle") IN ('', 'Новая публикация');

UPDATE "Post"
SET "metaTitle" = 'Пленэрная графика: холмистый луг', "metaTitleSource" = 'AUTO'
WHERE "slug" = 'plenernaya-grafika-holmistyj-lug'
  AND btrim("metaTitle") IN ('', 'Новая публикация');

UPDATE "Post"
SET "metaTitle" = 'Деревенский пейзаж под грозовым небом', "metaTitleSource" = 'AUTO'
WHERE "slug" = 'derevenskij-pejzazh-pod-grozovym-nebom'
  AND btrim("metaTitle") IN ('', 'Новая публикация');

UPDATE "Post"
SET "metaTitle" = 'Колокольня в Коломне', "metaTitleSource" = 'AUTO'
WHERE "slug" = 'kolokolnya-v-kolomne'
  AND btrim("metaTitle") IN ('', 'Новая публикация');

UPDATE "Post"
SET "metaTitle" = 'Графика с пленэра: пейзаж у воды', "metaTitleSource" = 'AUTO'
WHERE "slug" = 'grafika-s-plenera-pejzazh-u-vody'
  AND btrim("metaTitle") IN ('', 'Новая публикация');
