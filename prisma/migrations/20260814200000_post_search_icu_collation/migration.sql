-- The database was initialized with the C collation, where PostgreSQL ILIKE
-- does not fold Cyrillic characters ("Динамо" ≠ "динамо").
-- ICU's language-neutral collation makes the existing Prisma `mode: insensitive`
-- search case-insensitive for both Russian and Latin text.
ALTER TABLE "Post"
  ALTER COLUMN "title" TYPE TEXT COLLATE "und-x-icu" USING "title",
  ALTER COLUMN "slug" TYPE TEXT COLLATE "und-x-icu" USING "slug",
  ALTER COLUMN "body" TYPE TEXT COLLATE "und-x-icu" USING "body";
